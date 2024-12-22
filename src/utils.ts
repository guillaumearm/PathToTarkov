import { readFileSync, existsSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

export const fileExists = (path: string): boolean => {
  return existsSync(path);
};

export const readJsonFile = <T>(path: string): T => {
  if (!existsSync(path)) {
    throw new Error(`Path To Tarkov cannot read json file "${path}"`);
  }

  return JSON.parse(readFileSync(path, 'utf-8'));
};

export const writeJsonFile = <T>(path: string, x: T): void => {
  const str = JSON.stringify(x, undefined, 2);
  return writeFileSync(path, str, 'utf-8');
};

/**
 * package.json
 */
export type PackageJson = {
  name: string;
  displayName: string;
  version: string;
};

export const getModDisplayName = (packageJson: PackageJson, withVersion = false): string => {
  if (withVersion) {
    return `${packageJson.displayName} v${packageJson.version}`;
  }
  return `${packageJson.displayName}`;
};

// stackoverflow deep clone
export function deepClone<T>(item: T): T {
  if (!item) {
    return item;
  } // null, undefined values check

  const types = [Number, String, Boolean];
  let result: any;

  // normalizing primitives if someone did new String('aaa'), or new Number('444');
  types.forEach(function (type) {
    if (item instanceof type) {
      result = type(item);
    }
  });

  if (typeof result == 'undefined') {
    if (Object.prototype.toString.call(item) === '[object Array]') {
      result = [];
      (item as unknown as any[]).forEach(function (child, index) {
        result[index] = deepClone(child);
      });
    } else if (typeof item == 'object') {
      if (item && !(item as any).prototype) {
        // check that this is a literal
        if (item instanceof Date) {
          result = new Date(item);
        } else {
          // it is an object literal
          result = {};
          for (const i in item) {
            result[i] = deepClone(item[i]);
          }
        }
      } else {
        // just keep the reference
        result = item;
        // depending what you would like here,
      }
    } else {
      result = item;
    }
  }

  return result as T;
}

export function shuffle<T>(givenArray: T[]): T[] {
  const array = [...givenArray];

  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop(): void {}

export const isEmpty = (obj: object): boolean => {
  return Object.keys(obj).length === 0;
};

export const isEmptyArray = <T>(arr: T[] | undefined): boolean => {
  return Boolean(arr && arr.length > 0);
};

export const isLetterChar = (char: string): boolean => {
  return char.length === 1 && char.toUpperCase() !== char.toLowerCase();
};

export const isLowerLetterChar = (char: string): boolean => {
  return isLetterChar(char) && char.toLowerCase() === char;
};

export const isDigitChar = (char: string): boolean => {
  return char.length === 1 && char >= '0' && char <= '9';
};

export const isHexaChar = (char: string): boolean => {
  return isDigitChar(char) || (char.length === 1 && char >= 'a' && char <= 'f');
};

export const ensureArray = <T>(x: T | T[]): T[] => {
  if (Array.isArray(x)) {
    return x;
  }

  return [x];
};

/**
 * Mongo Ids
 */
const MONGO_ID_LENGTH = 24;

export const isValidMongoId = (id: string): boolean => {
  if (id.length !== MONGO_ID_LENGTH) {
    return false;
  }

  for (const char of id) {
    const isValidChar = isHexaChar(char);

    if (!isValidChar) {
      return false;
    }
  }

  return true;
};

const sha1 = (data: string): string => {
  const hash = createHash('sha1');
  hash.update(data);
  return hash.digest('hex');
};

export const MONGO_ID_PTT_PREFIX = 'deadbeef';

/**
 * This function is used to generate predictable mongo ids
 * a "deadbeef" prefix is added to help debugging profiles
 */
export const getPTTMongoId = (data: string): string => {
  const stripLength = MONGO_ID_LENGTH - MONGO_ID_PTT_PREFIX.length;
  const strippedHash = sha1(data).substring(0, stripLength);

  return MONGO_ID_PTT_PREFIX + strippedHash;
};
