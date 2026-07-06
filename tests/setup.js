const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { seedDatabase } = require('../seed');

let mongoServer;

beforeAll(async () => {
    // Spin up the Mongo in-memory server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Connect mongoose directly here
    await mongoose.connect(uri);

    // Seed the database with the mock test data
    await seedDatabase();
}, 60000);

afterAll(async () => {
    // Close connection and stop the server
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}, 60000);
