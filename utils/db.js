import { MongoClient } from 'mongodb';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 27017;
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${DB_HOST}:${DB_PORT}`;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

/**
 * Class to perform tasks relating to the MongoDB service
 */
class DBClient {
  constructor() {
    this.client = new MongoClient(url, options);
    this.client.connect().then(() => {
      // console.log('Connected successfully to server');
      this.db = this.client.db(DB_DATABASE);
      this.usersCollection = this.db.collection('users');
      this.filesCollection = this.db.collection('files');
    }).catch((err) => {
      console.log(`Failed to connect to MongoDB Server: ${err.message}`);
    });
  }

  /**
   * Checks if MongoDB connection is Alive
   * @return {boolean} true if the connection is alive
   */
  isAlive() {
    return this.client.topology.isConnected();
  }

  /**
   * Returns the number of documents in the collection users
   * @return {number} amount of users
   */
  async nbUsers() {
    try {
      const users = await this.usersCollection.countDocuments();
      return users;
    } catch (err) {
      throw new Error(`Unable to get number of users: ${err.message}`);
    }
  }

  /**
   * Returns the number of documents in the collection files
   * @return {number} amount of files
   */
  async nbFiles() {
    try {
      const files = await this.filesCollection.countDocuments();
      return files;
    } catch (err) {
      throw new Error(`Unable to get number of files: ${err.message}`);
    }
  }
}

const dbClient = new DBClient();
export default dbClient;
