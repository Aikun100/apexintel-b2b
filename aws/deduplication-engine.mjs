// Slices and deduplicates leads from master inventory for a customer
export function fulfillCustomerBatch(allLeads, customerEmail, requestedCount = 20) {
  // 1. Filter out any lead already delivered to this customer
  const eligibleLeads = allLeads.filter(lead => {
    const deliveredList = lead.delivered_to || [];
    return !deliveredList.includes(customerEmail.toLowerCase().trim());
  });

  if (eligibleLeads.length === 0) {
    return {
      success: false,
      message: `No new unseen leads remaining in this territory for ${customerEmail}.`,
      deliveredCount: 0,
      leads: []
    };
  }

  // 2. Slice the requested volume
  const batch = eligibleLeads.slice(0, requestedCount);

  // 3. Mark these leads as delivered to this customer in the ledger
  batch.forEach(lead => {
    if (!lead.delivered_to) lead.delivered_to = [];
    lead.delivered_to.push(customerEmail.toLowerCase().trim());
    lead.last_delivered_at = new Date().toISOString();
  });

  return {
    success: true,
    customerEmail,
    requestedCount,
    deliveredCount: batch.length,
    remainingUnseenForCustomer: eligibleLeads.length - batch.length,
    leads: batch
  };
}
