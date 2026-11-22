const mongoose = require('mongoose');
// Content hash invalidates translations automatically when the English source changes.
const schema = new mongoose.Schema({
  sourceHash: {type:String,required:true},
  languageCode: {type:String,required:true},
  originalText: {type:String,required:true},
  translatedText: {type:String,required:true},
  provider: {type:String,default:'google'},
  status: {type:String,enum:['published'],default:'published'},
}, {timestamps:true});
schema.index({sourceHash:1,languageCode:1},{unique:true});
module.exports = mongoose.model('ContentTranslation',schema);
