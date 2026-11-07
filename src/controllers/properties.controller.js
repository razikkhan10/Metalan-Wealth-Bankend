/**
 * controllers/properties.controller.js
 * ------------------------------------------------------------------
 * Property controller for both Admin and User flows.
 *
 * FAIX rule:
 *   1 FAIX Token = ₹11
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const Property = require('../models/Property.model');
const PropertyPurchase = require('../models/PropertyPurchase.model');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isTransactionsUnsupportedError } = require('../utils/transactionHelper');

const TOKEN_VALUE = 11;

function validateObjectId(id, fieldName = 'ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }
}

function normalizeImages(images) {
  if (images === undefined) return undefined;

  if (!Array.isArray(images)) {
    throw ApiError.badRequest('images must be an array.');
  }

  return images.map((image) => ({
    name: String(image?.name || '').trim(),
    url: String(image?.url || '').trim(),
  }));
}

/* ================================================================
   USER: GET ALL PROPERTIES
   GET /api/properties
   ================================================================ */

const getProperties = asyncHandler(async (req, res) => {
  const properties = await Property.find({ status: { $ne: 'Inactive' } })
    .sort({ createdAt: -1 })
    .lean();

  return new ApiResponse(200, 'Properties fetched successfully.', {
    count: properties.length,
    properties,
  }).send(res);
});

/* ================================================================
   USER: GET ONE PROPERTY
   GET /api/properties/:id
   ================================================================ */

const getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'property ID');

  const property = await Property.findById(id).lean();

  if (!property) {
    throw ApiError.notFound('Property not found.');
  }

  return new ApiResponse(200, 'Property fetched successfully.', {
    property,
  }).send(res);
});

/* ================================================================
   ADMIN: CREATE PROPERTY
   POST /api/admin/properties
   ================================================================ */

const adminCreateProperty = asyncHandler(async (req, res) => {
  const {
    propertyName,
    propertyPrice,
    propertyType,
    location,
    description,
    propertyImage,
    images,
    totalPropertyCost,
    status,
  } = req.body;

  if (!propertyName || propertyPrice === undefined || !propertyType || !location || totalPropertyCost === undefined) {
    throw ApiError.badRequest(
      'propertyName, propertyPrice, propertyType, location and totalPropertyCost are required.',
    );
  }

  const price = Number(propertyPrice);
  const totalCost = Number(totalPropertyCost);

  if (!Number.isFinite(price) || price < 0) {
    throw ApiError.badRequest('propertyPrice must be a valid non-negative number.');
  }

  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    throw ApiError.badRequest('totalPropertyCost must be a valid number greater than 0.');
  }

  // 1 FAIX Token = ₹11. Kept as a real decimal (Math.floor removed)
  // so totalPropertyCost converts to tokens exactly, e.g.
  // totalPropertyCost = 500000 -> totalFaixToken = 45454.545454...
  const totalFaixToken = totalCost / TOKEN_VALUE;

  if (totalFaixToken <= 0) {
    throw ApiError.badRequest('totalPropertyCost is too low to create at least 1 FAIX token.');
  }

  const normalizedImages = normalizeImages(images) || [];

  const property = await Property.create({
    propertyName: String(propertyName).trim(),
    propertyPrice: price,
    propertyType: String(propertyType).trim(),
    location: String(location).trim(),
    description: String(description || '').trim(),
    propertyImage: String(propertyImage || '').trim(),
    images: normalizedImages,
    totalPropertyCost: totalCost,
    totalFaixToken,
    availableFaixToken: totalFaixToken,
    soldFaixToken: 0,
    status: status || 'Available',
  });

  return new ApiResponse(201, 'Property created successfully.', {
    property,
    tokenRule: {
      tokenValue: TOKEN_VALUE,
      totalFaixToken,
    },
  }).send(res);
});

/* ================================================================
   USER: PURCHASE PROPERTY
   POST /api/properties/purchase

   DEEP EXAMPLE — HOW TO BUILD/READ THIS FUNCTION
   ------------------------------------------------------------------
   Required inputs (all in the request BODY now — no :id route
   param — plus the authenticated JWT):
     - `req.user.userId`   -> WHO is buying. This is the SHORT
                              sequential id ("0001", "0002", ...)
                              that was baked into the JWT at login
                              (see signToken() in
                              controllers/auth.controller.js). It
                              comes ONLY from the verified JWT, never
                              trusted from the request body, so
                              nobody can fake a purchase "as" another
                              user.
     - `req.body.propertyName` -> WHICH property is being bought,
                              matched by its exact name.
     - `req.body.purchasedFaixToken` -> HOW MANY FAIX tokens to buy.

   Example request:
     POST /api/properties/purchase
     Authorization: Bearer <protected token>
     Body:
       {
         "userID": "0001",
         "propertyName": "Skyline Residency",
         "purchasedFaixToken": 25
       }

   Note on "userID" in the body: it is OPTIONAL and only used as a
   sanity check against the JWT's userId — never as the source of
   truth. If it's sent and doesn't match the logged-in user's real
   userId, the request is rejected (stops a stolen/replayed body
   from being reused with a different account's token).

   Step-by-step:
     1. Read the short userId from the verified JWT
        (`req.user.userId`) — this is required; if it's missing, the
        account was registered before this feature existed and must
        log in again to get a fresh token (see JWT_SECRET/signToken
        comments) or actually never finished registration, since
        userId is only ever assigned by the registration flow.
     2. Read `propertyName` and `purchasedFaixToken` from the body.
     3. Open a MongoDB transaction (session) — a purchase touches
        FOUR collections (User, Property, Wallet, PropertyPurchase)
        plus a Transaction log; the session.withTransaction() call
        makes sure either ALL of those writes succeed together, or
        NONE of them do.
     4. Look the user up by their SHORT userId (`User.findOne({
        userId })`) — NOT `User.findById()` — and confirm active.
     5. Look the property up by its exact `propertyName`
        (`Property.findOne({ propertyName })`) and confirm it's
        actually for sale (`Available`/`Pending`, not `Sold`/
        `Inactive`).
     6. Check the user has enough unused FAIX tokens AND enough
        wallet balance, and the property has enough tokens left.
     7. Deduct wallet balance, bump the user's usedAmount/
        propertiesCount, deduct the property's availableFaixToken,
        and — only then — write the PropertyPurchase record with a
        full snapshot of WHO bought it (buyerName/buyerEmail/
        buyerUsername/buyerUserId/buyerPhone) alongside WHAT they
        bought, plus a matching Transaction log entry.
   ================================================================ */

const purchaseProperty = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw ApiError.unauthorized(
      'Authenticated userId is missing. Please log in again to get a fresh token.',
    );
  }

  const {
    userID: requestUserId,
    propertyName,
    purchasedFaixToken,
  } = req.body;

  // Optional consistency check only; JWT remains the source of truth.
  if (requestUserId && String(requestUserId) !== String(userId)) {
    throw ApiError.unauthorized('userID does not match the logged-in user.');
  }

  if (!propertyName || !String(propertyName).trim()) {
    throw ApiError.badRequest('propertyName is required.');
  }

  const tokenAmount = Number(purchasedFaixToken);

  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    throw ApiError.badRequest(
      'purchasedFaixToken must be a number greater than 0.',
    );
  }

  /**
   * performPurchase(session)
   * ----------------------------------------------------------------
   * All the actual read/validate/write steps for a purchase, shared
   * by BOTH the transactional path and the non-transactional
   * fallback path below. `session` is either a real Mongoose
   * ClientSession (transactional run) or `null` (fallback run) —
   * every `.session(session)` / `{ session }` call below accepts
   * `null` fine and simply runs outside a transaction.
   * ----------------------------------------------------------------
   */
  async function performPurchase(session) {
    // Look the buyer up by the SHORT sequential userId, not the
    // Mongo _id.
    const user = await User.findOne({ userId }).session(session);

    if (!user) {
      throw ApiError.notFound(`No user found with userId "${userId}".`);
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Your account is inactive.');
    }

    // Look the property up by its exact name.
    const property = await Property.findOne({
      propertyName: String(propertyName).trim(),
    }).session(session);

    if (!property) {
      throw ApiError.notFound(`No property found named "${propertyName}".`);
    }

    if (!['Available', 'Pending'].includes(property.status)) {
      throw ApiError.badRequest('This property is not available for purchase.');
    }

    const totalUserToken = Number(user.faixToken) || 0;
    const usedUserToken = Number(user.usedAmount) || 0;
    const availableUserToken = Math.max(totalUserToken - usedUserToken, 0);
    const availablePropertyToken = Number(property.availableFaixToken) || 0;

    if (tokenAmount > availableUserToken) {
      throw ApiError.badRequest(
        `Insufficient FAIX tokens. Available: ${availableUserToken}, Required: ${tokenAmount}.`,
      );
    }

    if (tokenAmount > availablePropertyToken) {
      throw ApiError.badRequest(
        `Property has only ${availablePropertyToken} FAIX tokens available.`,
      );
    }

    const purchaseAmount = tokenAmount * TOKEN_VALUE;
    const wallet = await Wallet.findOne({ user: user._id }).session(session);

    if (!wallet) {
      throw ApiError.notFound('Wallet not found.');
    }

    if (wallet.balance < purchaseAmount) {
      throw ApiError.badRequest('Insufficient wallet balance.');
    }

    wallet.balance -= purchaseAmount;
    await wallet.save({ session });

    // Deduct tokens from the authenticated user's usable balance.
    user.usedAmount = usedUserToken + tokenAmount;

    user.availableBalance =
      Math.max(totalUserToken - user.usedAmount, 0);

    user.propertiesCount = (Number(user.propertiesCount) || 0) + 1;

    await user.save({ session });

    // Reduce the property's remaining token inventory.
    property.availableFaixToken = availablePropertyToken - tokenAmount;
    property.soldFaixToken = (Number(property.soldFaixToken) || 0) + tokenAmount;
    property.status = property.availableFaixToken === 0 ? 'Sold' : 'Pending';
    await property.save({ session });

    // Create immutable purchase history record — WHO bought
    // (buyer* snapshot, frozen at this exact moment) + WHAT they
    // bought (property* snapshot).
    const [purchase] = await PropertyPurchase.create(
      [
        {
          user: user._id,

          // Buyer snapshot — "kaun is property ko purchase kar raha hai"
          buyerUserId: user.userId,
          buyerName: user.fullName,
          buyerUsername: user.username,
          buyerEmail: user.email,
          buyerPhone: user.phone,

          property: property._id,
          propertyName: property.propertyName,
          propertyType: property.propertyType,
          location: property.location,
          purchasedFaixToken: tokenAmount,
          tokenValue: TOKEN_VALUE,
          purchaseAmount,
          status: 'Completed',
        },
      ],
      { session },
    );

    await Transaction.create(
      [{
        user: user._id,
        type: 'Buy',
        asset: property.propertyName,
        amount: tokenAmount,
        price: TOKEN_VALUE,
        total: purchaseAmount,
        status: 'Completed',
      }],
      { session }
    );

    return {
      purchase,
      buyer: {
        id: user._id,
        userId: user.userId,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
      },
      userTokenSummary: {
        totalFaixToken: totalUserToken,
        usedFaixToken: user.usedAmount,
        availableFaixToken: Math.max(totalUserToken - user.usedAmount, 0),
      },
      propertyTokenSummary: {
        totalFaixToken: property.totalFaixToken,
        soldFaixToken: property.soldFaixToken,
        availableFaixToken: property.availableFaixToken,
      },
    };
  }

  // ------------------------------------------------------------
  // 1. Try the safe, atomic path first (needs a replica set/mongos).
  // ------------------------------------------------------------
  const session = await mongoose.startSession();
  let result;
  let transactionsSupported = true;

  try {
    await session.withTransaction(async () => {
      result = await performPurchase(session);
    });
  } catch (err) {
    if (isTransactionsUnsupportedError(err)) {
      // Standalone MongoDB — fall back below, outside this catch.
      transactionsSupported = false;
    } else {
      // A real error (validation, insufficient balance, etc.) —
      // this must still fail the request.
      throw err;
    }
  } finally {
    await session.endSession();
  }

  // ------------------------------------------------------------
  // 2. Fallback: standalone MongoDB doesn't support transactions,
  //    so re-run the exact same steps with session = null. Not
  //    atomic, but keeps the API working without any DB
  //    reconfiguration. (See README for how to enable a replica
  //    set locally and get the atomic path back.)
  // ------------------------------------------------------------
  if (!transactionsSupported) {
    result = await performPurchase(null);
  }

  return new ApiResponse(201, 'Property purchased successfully.', result).send(res);
});

/* ================================================================
   ADMIN: UPDATE PROPERTY
   PUT /api/admin/properties/:id
   ================================================================ */

const adminUpdateProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'property ID');

  const property = await Property.findById(id);

  if (!property) {
    throw ApiError.notFound('Property not found.');
  }

  const {
    propertyName,
    propertyPrice,
    propertyType,
    location,
    description,
    propertyImage,
    images,
    totalPropertyCost,
    status,
  } = req.body;

  if (propertyName !== undefined) property.propertyName = String(propertyName).trim();
  if (propertyType !== undefined) property.propertyType = String(propertyType).trim();
  if (location !== undefined) property.location = String(location).trim();
  if (description !== undefined) property.description = String(description).trim();
  if (propertyImage !== undefined) property.propertyImage = String(propertyImage).trim();

  if (propertyPrice !== undefined) {
    const price = Number(propertyPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw ApiError.badRequest('propertyPrice must be a valid non-negative number.');
    }
    property.propertyPrice = price;
  }

  if (totalPropertyCost !== undefined) {
    const totalCost = Number(totalPropertyCost);
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      throw ApiError.badRequest('totalPropertyCost must be a valid number greater than 0.');
    }

    const newTotalToken = totalCost / TOKEN_VALUE;
    if (newTotalToken <= 0) {
      throw ApiError.badRequest('totalPropertyCost is too low to create at least 1 FAIX token.');
    }

    const soldToken = Number(property.soldFaixToken) || 0;

    // Never allow an admin edit to make total inventory lower than sold tokens.
    if (newTotalToken < soldToken) {
      throw ApiError.badRequest(
        `totalPropertyCost would create ${newTotalToken} tokens, but ${soldToken} tokens are already sold.`,
      );
    }

    property.totalPropertyCost = totalCost;
    property.totalFaixToken = newTotalToken;
    property.availableFaixToken = newTotalToken - soldToken;

    if (property.availableFaixToken === 0) {
      property.status = 'Sold';
    }
  }

  if (Array.isArray(images)) {
    property.images = normalizeImages(images);
  }

  if (status !== undefined) {
    property.status = status;
  }

  await property.save();

  return new ApiResponse(200, 'Property updated successfully.', {
    property,
  }).send(res);
});

/* ================================================================
   ADMIN: DELETE PROPERTY
   DELETE /api/admin/properties/:id
   ================================================================ */

const adminDeleteProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateObjectId(id, 'property ID');

  const property = await Property.findById(id);

  if (!property) {
    throw ApiError.notFound('Property not found.');
  }

  const soldToken = Number(property.soldFaixToken) || 0;

  // Purchased history must remain valid, so purchased properties are deactivated.
  if (soldToken > 0) {
    property.status = 'Inactive';
    await property.save();

    return new ApiResponse(
      200,
      'Property has purchase history, so it was marked inactive instead of being deleted.',
      { property },
    ).send(res);
  }

  await Property.findByIdAndDelete(id);

  return new ApiResponse(200, 'Property deleted successfully.', null).send(res);
});

module.exports = {
  getProperties,
  getPropertyById,
  purchaseProperty,
  adminCreateProperty,
  adminUpdateProperty,
  adminDeleteProperty,
};
