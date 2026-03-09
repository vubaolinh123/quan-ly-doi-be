import Category from '../models/Category.js';
import Officer from '../models/Officer.js';

const createNoOfficerError = (categoryCode) => {
  const error = new Error('NO_OFFICER_FOR_CATEGORY');
  error.code = 'NO_OFFICER_FOR_CATEGORY';
  error.statusCode = 422;
  error.categoryCode = categoryCode;
  return error;
};

export const assignOfficerToTask = async (categoryCode) => {
  const normalizedCategoryCode = String(categoryCode || '').toUpperCase();

  const officers = await Officer.find({
    active: true,
    categoryCodes: normalizedCategoryCode
  }).sort({ createdAt: 1, _id: 1 });

  if (!officers.length) {
    throw createNoOfficerError(normalizedCategoryCode);
  }

  const category = await Category.findOneAndUpdate(
    { code: normalizedCategoryCode },
    { $inc: { assignmentCursor: 1 } },
    { new: false }
  );

  const cursor = category?.assignmentCursor ?? 0;
  return officers[cursor % officers.length];
};
