type DecimalLike = {
  toNumber?: () => number;
  toString: () => string;
};

export const decimalToNumber = (value: DecimalLike | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
};
