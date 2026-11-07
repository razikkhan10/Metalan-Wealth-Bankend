/** 
 * controllers/transaction.controller.js 
 * GET /api/transactions?search=&page=&limit= 
 *   Full, searchable, paginated transaction history for the logged-in user. 
 */ 
const Transaction = require('../models/Transaction.model'); 
const ApiError = require("../utils/ApiError"); 
const ApiResponse = require("../utils/ApiResponse"); 
 
async function listTransactions(req, res, next) { 
  try { 
    const userId = req.user.id; 
    const { search = '', page = 1, limit = 20 } = req.query; 
 
    const pageNum = Math.max(parseInt(page, 10) || 1, 1); 
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100); 
 
    const query = { user: userId }; 
    if (search) { 
      query.$or = [ 
        { asset: { $regex: search, $options: 'i' } }, 
        { type: { $regex: search, $options: 'i' } }, 
        { status: { $regex: search, $options: 'i' } }, 
      ]; 
    } 
 
    const [records, total] = await Promise.all([ 
      Transaction.find(query) 
        .sort({ date: -1 }) 
        .skip((pageNum - 1) * limitNum) 
        .limit(limitNum) 
        .lean(), 
      Transaction.countDocuments(query), 
    ]); 
 
    return new ApiResponse(
      200,
      'Transactions fetched successfully.',
      { 
        records, 
        pagination: { 
          page: pageNum, 
          limit: limitNum, 
          total, 
          totalPages: Math.ceil(total / limitNum), 
        }, 
      }
    ).send(res); 
  } catch (err) { 
    next(err); 
  } 
} 
 
async function createTransaction(req, res, next) { 
  try { 
    const userId = req.user.id; 
    const { type, asset, amount, price, total, status, date } = req.body; 
 
    if (!type || !asset || total === undefined) { 
      throw ApiError.badRequest(
        'type, asset, and total are required.'
      ); 
    } 
 
    const tx = await Transaction.create({ 
      user: userId, 
      type, 
      asset, 
      amount: amount || 0, 
      price: price || 0, 
      total, 
      status: status || 'Pending', 
      date: date || Date.now(), 
    }); 
 
    return new ApiResponse(
      201,
      'Transaction recorded.',
      { transaction: tx }
    ).send(res); 
  } catch (err) { 
    next(err); 
  } 
} 
 
module.exports = { listTransactions, createTransaction };