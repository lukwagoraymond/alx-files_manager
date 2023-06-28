import Queue from 'bull';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const queue = new Queue('fileQueue');

queue.process(async (job, done) => {
  const { fileId, userId } = job.data;
  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const fileDocument = await dbClient.filesCollection.findOne(
    {
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    },
  );
  if (!fileDocument) {
    throw new Error('File not found');
  }
  const { localPath } = fileDocument;
  const options = {};
  const widths = [500, 250, 100];

  widths.forEach(async (width) => {
    options.width = width;
    try {
      const thumbnail = await imageThumbnail(localPath, options);
      await fs.promises.writeFile(`${localPath}_${width}`, thumbnail);
    } catch (err) {
      console.error(err.message);
    }
  });
  done();
});

const queue2 = new Queue('userQueue');
queue2.process(async (job, done) => {
  const { userId } = job.data;
  if (!userId) {
    throw new Error('Missing userId');
  }
  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) {
    throw new Error('User not found');
  }
  console.log(`Welcome ${user.email}`);
  done();
});
