const path = require('path');
const terserPlugin = require('terser-webpack-plugin')
module.exports = {
  mode: 'production',
  entry: './js/main.bundle.js',
  optimization:{
    minimizer:[new terserPlugin()],
    minimize:true,
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.main.js',
    clean:true,
  },
  devtool: 'source-map', 
};