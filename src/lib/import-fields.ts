/**
 * Which fields an imported sheet can fill, and the header names commonly used
 * for each.
 *
 * Kept free of `server-only` and of any database import, because the mapping UI
 * is a client component and needs these labels too.
 */
export const FIELDS = {
  property: { label: "Property", required: true, aliases: ["property", "propertyname", "building", "propertyaddress", "complex"] },
  unit: { label: "Unit", required: false, aliases: ["unit", "unitname", "unitnumber", "apt", "apartment", "unit#"] },
  address1: { label: "Street address", required: false, aliases: ["address", "address1", "streetaddress", "street"] },
  city: { label: "City", required: false, aliases: ["city", "town"] },
  state: { label: "State", required: false, aliases: ["state", "st", "province"] },
  zip: { label: "ZIP", required: false, aliases: ["zip", "zipcode", "postalcode", "postcode"] },
  tenant: { label: "Tenant name", required: false, aliases: ["tenant", "tenantname", "resident", "residentname", "occupant", "leaseholder"] },
  email: { label: "Tenant email", required: false, aliases: ["email", "tenantemail", "emailaddress", "residentemail"] },
  phone: { label: "Tenant phone", required: false, aliases: ["phone", "tenantphone", "phonenumber", "mobile", "cell", "contact"] },
  leaseStart: { label: "Lease start", required: false, aliases: ["leasestart", "leasefrom", "startdate", "movein", "moveindate", "leasebegin"] },
  leaseEnd: { label: "Lease end / renewal date", required: true, aliases: ["leaseend", "leaseenddate", "leaseto", "enddate", "expiration", "expirationdate", "leaseexpiration", "renewaldate", "renewal", "moveout", "leaseexpires", "expires", "effectivedateofincrease"] },
  rent: { label: "Current rent", required: false, aliases: ["rent", "currentrent", "rentamount", "monthlyrent", "amount"] },
  proposedRent: { label: "Suggested / new rent", required: false, aliases: ["sugrent", "suggestedrent", "newrent", "proposedrent", "increasedrent", "renewalrent"] },
  subsidized: { label: "Subsidised?", required: false, aliases: ["sub", "subsidy", "subsidized", "subsidised", "voucher", "hap", "section8"] },
  squareFeet: { label: "Square feet", required: false, aliases: ["sqft", "squarefeet", "squarefootage", "sf"] },
  status: { label: "Status", required: false, aliases: ["status", "paymenthistory"] },
  marketRent: { label: "Market rent", required: false, aliases: ["marketrent", "market", "askingrent", "targetrent"] },
  owner: { label: "Owner", required: false, aliases: ["owner", "ownername", "landlord"] },
  ownerEmail: { label: "Owner email", required: false, aliases: ["owneremail"] },
  ownerPhone: { label: "Owner phone", required: false, aliases: ["ownerphone"] },
  bedrooms: { label: "Bedrooms", required: false, aliases: ["bedrooms", "beds", "br", "bed"] },
  bathrooms: { label: "Bathrooms", required: false, aliases: ["bathrooms", "baths", "ba", "bath"] },
  notes: { label: "Notes", required: false, aliases: ["notes", "note", "comments", "remarks"] },
} as const;

export type FieldKey = keyof typeof FIELDS;
export type Mapping = Partial<Record<FieldKey, string>>;

export const FIELD_ORDER = Object.keys(FIELDS) as FieldKey[];
