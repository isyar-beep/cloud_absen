const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server cloud_absen berjalan di port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
