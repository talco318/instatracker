import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required'
  })
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

export const trackerSchema = Joi.object({
  instagramUsername: Joi.string()
    .pattern(/^@?[a-zA-Z0-9._]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Instagram username format',
      'any.required': 'Instagram username is required'
    }),
  notificationEmail: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid notification email address',
    'any.required': 'Notification email is required'
  })
});