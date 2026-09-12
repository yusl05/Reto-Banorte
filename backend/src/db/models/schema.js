import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  accountDetails: {
    creditCardNumber: String,
    totalDebt: Number,
    creditLimit: Number,
    bureauScore: Number
  },
  createdAt: { type: Date, default: Date.now }
});

const agentStateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activePromptContext: String,
  currentIntent: String,
  activeLayoutPreset: String,
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const AgentState = mongoose.model('AgentState', agentStateSchema);