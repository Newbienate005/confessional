// src/migrations/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

async function seed() {
  console.log('🌱 Seeding database...');
  try {
    // Admin user
    const adminHash = await bcrypt.hash('Admin@123!', ROUNDS);
    const { rows: [admin] } = await query(`
      INSERT INTO users (username, email, password_hash, role, status, email_verified)
      VALUES ($1, $2, $3, 'admin', 'active', true)
      ON CONFLICT (email) DO UPDATE SET role = 'admin'
      RETURNING id
    `, ['Admin', 'admin@confessional.app', adminHash]);

    // Demo user
    const userHash = await bcrypt.hash('Demo@123!', ROUNDS);
    const { rows: [demo] } = await query(`
      INSERT INTO users (username, email, password_hash, role, status, email_verified)
      VALUES ($1, $2, $3, 'user', 'active', true)
      ON CONFLICT (email) DO UPDATE SET username = $1
      RETURNING id
    `, ['Ghost_7742', 'demo@confessional.app', userHash]);

    // Seed posts
    const seedPosts = [
      { content: "I've been pretending to be happy at work for 3 years. Every morning I sit in my car for 10 minutes just to compose myself before walking in. Nobody knows.", category: 'Work' },
      { content: "I still sleep with a stuffed animal I've had since I was 4. I'm 28. It helps with my anxiety and I refuse to feel ashamed about it anymore.", category: 'Mental Health' },
      { content: "I accidentally got CC'd on an email where my whole team called me 'the weakest link'. I've been job hunting ever since but told no one.", category: 'Work' },
      { content: "I told my parents I graduated college. I didn't. I've been faking it for 2 years. The shame is eating me alive.", category: 'Family' },
      { content: "I've been messaging my ex under a fake account just to see if they're okay. We ended badly and I needed to know.", category: 'Relationships' },
      { content: "I failed my first year of med school and retook it. None of my fellow residents know. Every day I wonder if I'm actually cut out for this.", category: 'School' },
    ];

    for (const p of seedPosts) {
      await query(`
        INSERT INTO posts (user_id, content, category)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [demo.id, p.content, p.category]);
    }

    console.log('✅ Seed data inserted');
    console.log('   Admin: admin@confessional.app / Admin@123!');
    console.log('   Demo:  demo@confessional.app  / Demo@123!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
