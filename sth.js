const { getTransitTime } = require("./google-map-api");


getTransitTime('Melbourne VIC', 'Docklands VIC').then(result => {
  if (result) console.log('Transit time:', result.text);
});