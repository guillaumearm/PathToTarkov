import { getPTTMongoId, isValidMongoId } from '../src/utils';

describe('PTT utils', () => {
  describe('getPTTMongoId', () => {
    it('should get a string of length 24', () => {
      expect(getPTTMongoId('').length).toBe(24);
      expect(getPTTMongoId('test').length).toBe(24);
    });

    it('should get a valid mongo id', () => {
      const mongoId = getPTTMongoId('test');
      expect(isValidMongoId(mongoId)).toBe(true);
    });

    it('should check that ids are not equals for 2 different inputs data', () => {
      const mongoId1 = getPTTMongoId('test1');
      const mongoId2 = getPTTMongoId('test2');
      expect(mongoId1).not.toBe(mongoId2);
    });

    it('should check that the function is pure', () => {
      expect(getPTTMongoId('test')).toBe(getPTTMongoId('test'));
      expect(getPTTMongoId('test1')).toBe(getPTTMongoId('test1'));
      expect(getPTTMongoId('test2')).toBe(getPTTMongoId('test2'));
      expect(getPTTMongoId('test3')).toBe(getPTTMongoId('test3'));
    });

    it('should check that the id start with "PTT" preefix', () => {
      expect(getPTTMongoId('test').startsWith('deadbeef')).toBe(true);
    });
  });
});
