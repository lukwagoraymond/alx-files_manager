import express from 'express';
import router from './routes/index';

const PORT = process.env.PORT || 5000;

const app = express();

// Middleware to decode JSON data incoming requests
app.use(express.json());

// routes
app.use(router);

app.listen(PORT, () => {
  console.log(`Project app listening on port ${PORT}`);
});
