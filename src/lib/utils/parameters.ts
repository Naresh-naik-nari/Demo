/**
 * @file parameters.ts
 * @module lib/utils/parameters
 * @description Utilities for encoding and decoding MAVLink parameter values.
 *
 * MAVLink parameters are typed (uint8, int16, float, etc.). These helpers
 * clamp numeric values to valid ranges before writing them to the FC.
 */

/**
 * MAVLink parameter type enum values.
 * @see https://mavlink.io/en/messages/common.html#MAV_PARAM_TYPE
 */
export const enum MavParamType {
  UINT8  = 1,
  INT8   = 2,
  UINT16 = 3,
  INT16  = 4,
  UINT32 = 5,
  INT32  = 6,
  UINT64 = 7,
  INT64  = 8,
  FLOAT  = 9,
  DOUBLE = 10,
}

/**
 * Clamps `value` to the valid range for `paramType` and rounds integers.
 * Returns the value unchanged for float/double types.
 *
 * @param value     - Raw numeric value
 * @param paramType - MAVLink MAV_PARAM_TYPE integer
 */
export function encodeParameterValue(value: number, paramType: number): number {
  switch (paramType) {
    case MavParamType.UINT8:
      return Math.min(255, Math.max(0, Math.round(value)));
    case MavParamType.INT8:
      return Math.min(127, Math.max(-128, Math.round(value)));
    case MavParamType.UINT16:
      return Math.min(65535, Math.max(0, Math.round(value)));
    case MavParamType.INT16:
      return Math.min(32767, Math.max(-32768, Math.round(value)));
    case MavParamType.UINT32:
      return Math.min(4294967295, Math.max(0, Math.round(value)));
    case MavParamType.INT32:
      return Math.min(2147483647, Math.max(-2147483648, Math.round(value)));
    case MavParamType.UINT64:
    case MavParamType.INT64:
      console.warn('[parameters] 64-bit integers may lose precision in JavaScript');
      return value;
    case MavParamType.FLOAT:
    case MavParamType.DOUBLE:
      return value;
    default:
      console.warn('[parameters] Unknown parameter type:', paramType);
      return value;
  }
}

/**
 * Decodes a raw float value received from the FC back to the correct type range.
 * This is the inverse of `encodeParameterValue` and applies the same clamping.
 *
 * @param encodedValue - String representation of the value as received from PARAM_VALUE
 * @param paramType    - MAVLink MAV_PARAM_TYPE integer as a string
 */
export function decodeParameterValue(encodedValue: string, paramType: string): number {
  const value = parseFloat(encodedValue);
  const type = parseInt(paramType);

  if (isNaN(value)) {
    console.warn('[parameters] Invalid parameter value:', encodedValue);
    return 0;
  }

  return encodeParameterValue(value, type);
}
