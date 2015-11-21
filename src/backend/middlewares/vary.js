module.exports = function vary() {
  return (req, res, next) => {
    res.header("Vary", "Accept-Encoding");
    next();
  }
}
