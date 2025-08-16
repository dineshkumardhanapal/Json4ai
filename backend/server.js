require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
// (prompt & stripe routes added later)

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));