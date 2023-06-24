import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.connected = false;
    this.client = createClient({
      socket: {
        host: 'localhost',
        port: 6379,
      },
    });
    this.client.on('error', (err) => {
      this.connected = false;
      console.log(`Redis client not connected to the server: ${err.message}`);
    });
    this.client.on('connect', () => {
      this.connected = true;
      console.log('Redis client connected to the server');
    });
    this.asyncGet = promisify(this.client.get).bind(this.client);
    this.asyncSet = promisify(this.client.set).bind(this.client);
    this.asyncDel = promisify(this.client.del).bind(this.client);
  }

  /**
   * Checks if connection to Redis is OK
   * @return {boolean} true if connection alive or false if not
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Gets value corresponding to key in redis
   * @key {string} key used to search in redis
   * @return {string} value of key searched in redis
   */
  async get(key) {
    try {
      const data = await this.asyncGet(key);
      return data;
    } catch (err) {
      return (`Value not found for: ${key}`);
    }
  }

  /**
   * Stores data in Redis
   * @key {string} unique key to be stored in redis
   * @value {string} value corresponding to key in redis
   * @duration {number} expiration duration to the key
   * @return {object} key-value pair with an expiration time
   */
  async set(key, value, duration) {
    try {
      await this.asyncSet(key, value, 'EX', duration);
    } catch (err) {
      throw new Error(`Failed to store ${key}: ${err.message}`);
    }
  }

  /**
   * Removes a value from a Redis DB
   * @key {string} unique key to search Redis
   * @return {null} to confirm successful deletion
   */
  async del(key) {
    try {
      await this.asyncDel(key);
    } catch (err) {
      console.log(`Failed to delete ${key}: ${err.message}`);
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
