require('dotenv').config({path: '.env'});
const {pool} = require('./config/db');
pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'payload'").then(res => {
  console.log(res.rows);
  pool.end();
});
