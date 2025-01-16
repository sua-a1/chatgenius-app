export const config = {
  runtime: 'edge',
  regions: ['us-east-1'], // Specify your preferred region
  maxDuration: 60, // Maximum execution time in seconds
  memory: 1024, // Memory limit in MB
  cors: {
    allowedOrigins: ['*'], // Update with your actual domains in production
    allowedMethods: ['POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600 // 10 minutes
  }
}; 