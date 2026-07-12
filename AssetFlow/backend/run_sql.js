const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log("Connecting to the database...");
    await client.connect();
    
    console.log("Reading SQL file...");
    const sql = fs.readFileSync('./assetflow_schema.sql', 'utf8');
    
    console.log("Executing SQL...");
    await client.query(sql);
    
    console.log("Successfully executed SQL commands.");
  } catch (error) {
    console.error("Error executing SQL:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
