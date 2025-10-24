import Joi from 'joi';

/**
 * Validation schema for parse endpoint (POST JSON body)
 */
export const parseSchema = Joi.object({
    url: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .required()
        .messages({
            'string.uri': 'URL must be a valid HTTP or HTTPS URL',
            'any.required': 'URL parameter is required'
        }),
    
    screenshot: Joi.object({
        enabled: Joi.boolean().default(false),
        full_page: Joi.boolean().default(false)
    }).default({ enabled: false, full_page: false }),
    
    network: Joi.object({
        enabled: Joi.boolean().default(false),
        show_code: Joi.boolean().default(false),
        block_urls: Joi.array().items(Joi.string().uri()).default([]),
        allow_types: Joi.array().items(
            Joi.string().valid('document', 'script', 'stylesheet', 'image', 'font', 'xhr', 'fetch', 'websocket', 'manifest', 'media', 'texttrack', 'eventsource', 'other')
        ).default([]),
        wait_until: Joi.string()
            .valid('load', 'domcontentloaded', 'networkidle0', 'networkidle2')
            .default('networkidle0')
    }).default({ enabled: false, show_code: false, block_urls: [], allow_types: [], wait_until: 'networkidle0' }),
    
    viewport: Joi.object({
        width: Joi.number().integer().min(320).max(3840).default(1200),
        height: Joi.number().integer().min(240).max(2160).default(800)
    }).default({ width: 1200, height: 800 }),
    
    timeout: Joi.number()
        .integer()
        .min(5000)
        .max(60000)
        .default(30000)
        .messages({
            'number.min': 'Timeout must be at least 5000ms (5 seconds)',
            'number.max': 'Timeout cannot exceed 60000ms (60 seconds)'
        }),
    
    user_agent: Joi.string()
        .max(500)
        .optional(),
    
    proxy: Joi.object({
        enabled: Joi.boolean().default(false),
        type: Joi.string()
            .valid('static', 'hybrid')
            .default('hybrid'),
        host: Joi.string().optional(),
        port: Joi.number().integer().min(1).max(65535).optional(),
        username: Joi.string().optional(),
        password: Joi.string().optional()
    }).default({ enabled: false, type: 'hybrid' }),
    
    save: Joi.boolean()
        .default(false)
        .optional()
        .messages({
            'boolean.base': 'Save must be a boolean value (true or false)'
        })
});

/**
 * Middleware to validate request JSON body
 */
export const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { 
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true
        });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors
            });
        }
        
        req.validatedBody = value;
        next();
    };
};

/**
 * Convert string boolean parameters to actual booleans
 */
export const parseBoolean = (value) => {
    return value === 'true';
};

/**
 * Parse comma-separated string into array
 */
export const parseArray = (value) => {
    return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
};
