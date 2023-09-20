export const formatSkeetFromNWSAlert = (alert) => {
  return (`
    DENTON WEATHER ALERT:\n\n${alert.properties.description.substring(0, 220)}...\n\nFor more information, visit weather.gov/fwd/
  `);
};

export const formatLog = ({ error, method }) => {
  return `\n[${new Date().toLocaleString("en-US")}] - "${method}" ${error}`;
};
