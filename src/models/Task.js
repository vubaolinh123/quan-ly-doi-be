import mongoose from 'mongoose';
import { TASK_ACTIVITIES, TASK_PRIORITIES, TASK_STATUSES } from '../constants/domain.constants.js';

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề công việc là bắt buộc'],
      trim: true
    },
    categoryCode: {
      type: String,
      required: [true, 'Hạng mục là bắt buộc'],
      uppercase: true,
      trim: true
    },
    activity: {
      type: String,
      enum: TASK_ACTIVITIES,
      required: [true, 'Hoạt động là bắt buộc']
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'medium'
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'new'
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Officer',
      required: [true, 'Cán bộ phụ trách là bắt buộc']
    },
    deadline: {
      type: Date,
      required: [true, 'Hạn xử lý là bắt buộc']
    },
    sourceReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null
    },
    description: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ status: 1, deadline: 1 });
taskSchema.index({ categoryCode: 1, status: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
