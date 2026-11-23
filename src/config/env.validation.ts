import * as Joi from 'joi';

/** The app refuses to start when the environment is invalid. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().min(8).required(),
  JWT_EXPIRES_IN_SECONDS: Joi.number().integer().positive().default(3600),
  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),

  /** Where claim documents are stored on disk. */
  UPLOAD_DIR: Joi.string().default('uploads'),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  TRUST_PROXY: Joi.boolean().default(false),
});
