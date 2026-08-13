'use strict';

const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Redactor API listening on port ${PORT}`);
});
