const HOME_TYPE_ALIASES = new Map([
  ["HOUSE", "SINGLE_FAMILY"],
  ["SINGLE FAMILY", "SINGLE_FAMILY"],
  ["SINGLE_FAMILY", "SINGLE_FAMILY"],
  ["SINGLE FAMILY RESIDENCE", "SINGLE_FAMILY"],
  ["TOWNHOME", "TOWNHOUSE"],
  ["TOWN HOUSE", "TOWNHOUSE"],
  ["MULTIFAMILY", "MULTI_FAMILY"],
  ["MULTI FAMILY", "MULTI_FAMILY"],
  ["MANUFACTURED HOME", "MANUFACTURED"],
]);

export function numericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeHomeType(value) {
  if (!value) return "UNKNOWN";
  const normalized = String(value).trim().toUpperCase().replaceAll("-", "_");
  return HOME_TYPE_ALIASES.get(normalized) ?? normalized;
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function formatAddress(address) {
  if (typeof address === "string") return address;
  if (!address || typeof address !== "object") return "Address unavailable";

  const street = address.streetAddress ?? address.addressStreet ?? address.street;
  const city = address.city ?? address.addressCity;
  const state = address.state ?? address.addressState;
  const zip = address.zipcode ?? address.zipCode ?? address.addressZipcode;
  const locality = [city, state].filter(Boolean).join(", ");
  return [street, [locality, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function selectPhoto(property) {
  if (typeof property.imgSrc === "string") return property.imgSrc;
  const photos = Array.isArray(property.responsivePhotos) ? property.responsivePhotos : [];
  for (const photo of photos) {
    const webp = photo?.mixedSources?.webp;
    const jpeg = photo?.mixedSources?.jpeg;
    const candidates = Array.isArray(webp) && webp.length > 0 ? webp : jpeg;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const widest = [...candidates].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (widest?.url) return widest.url;
    }
    if (photo?.url) return photo.url;
  }
  return null;
}

function compAddress(comp) {
  if (comp.address) return formatAddress(comp.address);
  return formatAddress({
    streetAddress: comp.addressStreet,
    city: comp.addressCity,
    state: comp.addressState,
    zipcode: comp.addressZipcode,
  });
}

export function calculateValuation(property, nearbyRows) {
  const askingPrice = numericValue(property.price);
  const zestimate = numericValue(property.zestimate);
  const subjectSqft = numericValue(property.livingArea ?? property.resoFacts?.livingArea);
  const subjectType = normalizeHomeType(property.homeType ?? property.resoFacts?.homeType);

  if (!property.zpid) throw new Error("This address did not return a property ID.");
  if (!askingPrice || askingPrice <= 0) throw new Error("This property does not have a current asking price.");
  if (!zestimate || zestimate <= 0) throw new Error("This property does not include a Zestimate.");
  if (!subjectSqft || subjectSqft <= 0) throw new Error("This property does not include its living area.");
  if (subjectType === "UNKNOWN") throw new Error("This property does not include a home type.");

  const minSqft = subjectSqft * 0.7;
  const maxSqft = subjectSqft * 1.3;
  const validComps = [];

  for (const row of nearbyRows) {
    const price = numericValue(row.unformattedPrice ?? row.price);
    const sqft = numericValue(row.area ?? row.livingArea);
    const type = normalizeHomeType(row.homeType ?? row.hdpData?.homeInfo?.homeType);
    if (!price || !sqft || price <= 0 || sqft <= 0) continue;
    if (type !== subjectType || sqft < minSqft || sqft > maxSqft) continue;

    validComps.push({
      zpid: String(row.zpid ?? row.id ?? ""),
      address: compAddress(row),
      price,
      sqft,
      pricePerSqft: price / sqft,
      beds: numericValue(row.beds),
      baths: numericValue(row.baths),
      imageUrl: typeof row.imgSrc === "string" ? row.imgSrc : null,
      sizeDifference: Math.abs(sqft - subjectSqft) / subjectSqft,
    });
  }

  if (validComps.length === 0) {
    throw new Error("No nearby homes match this property’s type and size range.");
  }

  const pricePerSqftValues = validComps.map((comp) => comp.pricePerSqft);
  const medianPricePerSqft = median(pricePerSqftValues);
  const compValue = medianPricePerSqft * subjectSqft;
  const fairValue = zestimate * 0.6 + compValue * 0.4;
  const rangeLow = fairValue * 0.93;
  const rangeHigh = fairValue * 1.07;
  const verdict = askingPrice < rangeLow ? "Below" : askingPrice > rangeHigh ? "Above" : "Fair";

  const sampleScore = Math.min(validComps.length / 6, 1);
  const q1 = percentile(pricePerSqftValues, 0.25);
  const q3 = percentile(pricePerSqftValues, 0.75);
  const spread = medianPricePerSqft > 0 ? (q3 - q1) / medianPricePerSqft : 1;
  const consistencyScore = 1 - Math.min(spread / 0.45, 1);
  const estimateGap = Math.abs(zestimate - compValue) / Math.max(zestimate, compValue);
  const agreementScore = 1 - Math.min(estimateGap / 0.35, 1);
  const confidenceScore = Math.round((sampleScore * 0.5 + consistencyScore * 0.3 + agreementScore * 0.2) * 100);
  const confidence = confidenceScore >= 80 ? "High" : confidenceScore >= 60 ? "Medium" : "Low";

  const topComps = validComps
    .sort((a, b) => a.sizeDifference - b.sizeDifference || a.address.localeCompare(b.address))
    .slice(0, 5)
    .map(({ sizeDifference: _sizeDifference, ...comp }) => comp);

  return {
    property: {
      zpid: String(property.zpid),
      address: formatAddress(property.address),
      askingPrice,
      zestimate,
      sqft: subjectSqft,
      homeType: subjectType,
      beds: numericValue(property.bedrooms),
      baths: numericValue(property.bathrooms),
      yearBuilt: numericValue(property.yearBuilt),
      imageUrl: selectPhoto(property),
    },
    valuation: {
      compValue,
      fairValue,
      rangeLow,
      rangeHigh,
      verdict,
      confidence,
      confidenceScore,
      compCount: validComps.length,
      medianPricePerSqft,
    },
    comps: topComps,
  };
}
