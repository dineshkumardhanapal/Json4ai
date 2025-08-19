const cron = require('node-cron');
const User = require('./models/User');

cron.schedule('0 0 * * *', async () => {
  await User.updateMany(
    { plan: 'free' },
    { credits: 3, lastFreeReset: new Date() }
  );
  console.log('Free credits reset');
});

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
app.use('/api/prompt', require('./routes/prompt'));