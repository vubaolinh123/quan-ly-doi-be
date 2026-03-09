import mongoose from 'mongoose';
import Category from '../src/models/Category.js';
import Officer from '../src/models/Officer.js';
import Task from '../src/models/Task.js';
import { assignOfficerToTask } from '../src/services/assignment.service.js';

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cong-tac-cshs';
const categoryArg = process.argv.find((arg) => arg.startsWith('--category='));
const categoryMode = categoryArg ? categoryArg.split('=')[1] : null;

const cleanup = async () => {
  await Task.deleteMany({ title: /^RR Task/, categoryCode: { $in: ['TEST_RR', 'EMPTY'] } });
  await Officer.deleteMany({ hoTen: { $in: ['A', 'B', 'C'] } });
  await Category.deleteMany({ code: { $in: ['TEST_RR', 'EMPTY'] } });
};

const createRoundRobinFixtures = async () => {
  await Category.create({
    code: 'TEST_RR',
    name: 'Round robin test',
    color: '#1D4ED8',
    assignmentCursor: 0,
    active: true
  });

  const base = Date.now();
  await Officer.insertMany([
    {
      hoTen: 'A',
      categoryCodes: ['TEST_RR'],
      active: true,
      createdAt: new Date(base),
      updatedAt: new Date(base)
    },
    {
      hoTen: 'B',
      categoryCodes: ['TEST_RR'],
      active: true,
      createdAt: new Date(base + 1000),
      updatedAt: new Date(base + 1000)
    },
    {
      hoTen: 'C',
      categoryCodes: ['TEST_RR'],
      active: true,
      createdAt: new Date(base + 2000),
      updatedAt: new Date(base + 2000)
    }
  ]);
};

const runRoundRobinSequenceTest = async () => {
  await createRoundRobinFixtures();

  const actual = [];
  for (let i = 1; i <= 6; i += 1) {
    const officer = await assignOfficerToTask('TEST_RR');
    actual.push(officer.hoTen);
    await Task.create({
      title: `RR Task ${i}`,
      categoryCode: 'TEST_RR',
      activity: 'PHAT_HIEN',
      assignee: officer._id,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  }

  const expected = ['A', 'B', 'C', 'A', 'B', 'C'];
  if (actual.join(',') !== expected.join(',')) {
    throw new Error(`Expected sequence ${expected.join(',')} but got ${actual.join(',')}`);
  }

  console.log(`PASS: sequence=${actual.join(',')}`);
};

const runEmptyCategoryTest = async () => {
  await Category.create({
    code: 'EMPTY',
    name: 'Empty category test',
    color: '#B91C1C',
    assignmentCursor: 0,
    active: true
  });

  try {
    await assignOfficerToTask('EMPTY');
    throw new Error('Expected NO_OFFICER_FOR_CATEGORY but assignment succeeded');
  } catch (error) {
    if (error.code !== 'NO_OFFICER_FOR_CATEGORY') {
      throw error;
    }
  }

  console.log('PASS: empty category returns NO_OFFICER_FOR_CATEGORY');
};

const main = async () => {
  try {
    await mongoose.connect(mongoUri);
    await cleanup();

    if (categoryMode === 'EMPTY') {
      await runEmptyCategoryTest();
    } else {
      await runRoundRobinSequenceTest();
    }

    await cleanup();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);

    if (mongoose.connection.readyState === 1) {
      await cleanup();
      await mongoose.connection.close();
    }

    process.exit(1);
  }
};

main();
