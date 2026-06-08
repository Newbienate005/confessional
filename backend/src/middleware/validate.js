// src/middleware/validate.js
const { body, param, query, validationResult } = require('express-validator');

/** Throw 400 if any validation failed */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ── Auth validators ───────────────────────────────────────
const validateRegister = [
  body('username')
    .trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers, underscores'),
  body('email')
    .trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password needs at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password needs at least one number'),
  body('acceptedTerms')
    .equals('true').withMessage('You must accept the Terms & Conditions'),
  handleValidation,
];

const validateLogin = [
  body('identifier').trim().notEmpty().withMessage('Email or username required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation,
];

const validateForgotPassword = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
  handleValidation,
];

const validateResetPassword = [
  body('token').trim().notEmpty().withMessage('Reset token required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Needs uppercase letter')
    .matches(/[0-9]/).withMessage('Needs a number'),
  handleValidation,
];

// ── Post validators ───────────────────────────────────────
const VALID_CATEGORIES = ['Relationships','School','Family','Work','Mental Health','Random','Secrets'];

const validatePost = [
  body('content')
    .trim().isLength({ min: 10, max: 1000 }).withMessage('Confession must be 10-1000 characters'),
  body('category')
    .optional()
    .isIn(VALID_CATEGORIES).withMessage('Invalid category'),
  handleValidation,
];

const validateComment = [
  body('content').trim().isLength({ min: 1, max: 500 }).withMessage('Comment must be 1-500 characters'),
  handleValidation,
];

const validateUUID = (paramName) => [
  param(paramName).isUUID().withMessage('Invalid ID format'),
  handleValidation,
];

const validateReaction = [
  body('reactionType').isIn(['love','laugh','sad','shocked']).withMessage('Invalid reaction type'),
  handleValidation,
];

const validateReport = [
  body('reason').isIn(['Hate speech','Spam or scam','False information','Harassment','Graphic content','Self-harm','Other']).withMessage('Invalid report reason'),
  body('description').optional().isLength({ max: 500 }),
  handleValidation,
];

module.exports = {
  validateRegister, validateLogin, validateForgotPassword, validateResetPassword,
  validatePost, validateComment, validateUUID, validateReaction, validateReport,
};
