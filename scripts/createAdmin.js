/**
 * Script to create an admin user with demo credentials
 * 
 * Usage: node scripts/createAdmin.js
 * 
 * Creates admin user with:
 * Email: admin@example.com
 * Password: admin123
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('Error: MONGO_URI is not defined in .env file');
  process.exit(1);
}

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const email = 'admin@example.com';
    const password = 'admin123';
    const name = 'Admin User';

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: email.toLowerCase()
    });

    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        // Reset password to ensure it's correct
        existingAdmin.password = password; // Will be hashed by pre-save hook
        await existingAdmin.save();
        
        // Verify password works
        const verifyAdmin = await User.findOne({ email: email.toLowerCase() });
        const passwordCheck = await verifyAdmin.comparePassword(password);
        
        console.log('✅ Admin user already exists - password reset');
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Name: ${existingAdmin.name}`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   Password verification: ${passwordCheck ? '✅ Valid' : '❌ Invalid'}`);
        console.log('\n📝 Admin Login Credentials:');
        console.log('   Email: admin@example.com');
        console.log('   Password: admin123');
        await mongoose.disconnect();
        process.exit(0);
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin';
        existingAdmin.password = password; // Will be hashed by pre-save hook
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin');
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Name: ${existingAdmin.name}`);
        console.log(`   Password: ${password}`);
        await mongoose.disconnect();
        process.exit(0);
      }
    }

    // Create new admin user
    // The password will be automatically hashed by the pre-save hook
    const admin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password, // Will be hashed automatically
      role: 'admin'
    });

    // Verify the admin was created correctly
    const verifyAdmin = await User.findOne({ email: email.toLowerCase() });
    const passwordCheck = await verifyAdmin.comparePassword(password);
    
    console.log('✅ Admin user created successfully!');
    console.log(`   ID: ${admin._id}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Password verification: ${passwordCheck ? '✅ Valid' : '❌ Invalid'}`);
    console.log('\n📝 Admin Login Credentials:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('\n🔗 Access admin panel at: http://localhost:5173/admin/login');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdmin();

