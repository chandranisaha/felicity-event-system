const getDynamicEventStatus = (event, now = new Date()) => {
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  if (now < startDate) {
    return "Upcoming";
  }
  if (now >= startDate && now <= endDate) {
    return "Ongoing";
  }
  return "Completed";
};

const attachDisplayStatus = (event) => {
  const dynamicEventStatus = getDynamicEventStatus(event);
  const manual = event.manualEventStatus || null;
  const effectiveEventStatus = manual || dynamicEventStatus;

  const source = event.toObject ? event.toObject() : { ...event };
  return {
    ...source,
    dynamicEventStatus,
    effectiveEventStatus,
  };
};

module.exports = {
  getDynamicEventStatus,
  attachDisplayStatus,
};
