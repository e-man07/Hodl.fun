// IPFS controller tests
import { ipfsController } from '../ipfsController';
import { ipfsService } from '../../services/ipfsService';
import { createMockRequest, createMockResponse } from '../../__tests__/helpers/testUtils';
import { mockIPFSMetadata } from '../../__tests__/helpers/mockData';

// Mock services
jest.mock('../../services/ipfsService');

describe('IPFSController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetadata', () => {
    it('should fetch metadata from IPFS successfully', async () => {
      const ipfsHash = 'QmTest123';

      (ipfsService.fetchMetadata as jest.Mock).mockResolvedValue(mockIPFSMetadata);

      const req = createMockRequest({
        params: { hash: ipfsHash },
      });
      const res = createMockResponse();

      await ipfsController.getMetadata(req as any, res as any);

      expect(ipfsService.fetchMetadata).toHaveBeenCalledWith(ipfsHash);
      expect(res.json).toHaveBeenCalled();
      const callArg = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data).toEqual(mockIPFSMetadata);
    });

    it('should return 404 when metadata not found', async () => {
      const ipfsHash = 'QmNonExistent';

      (ipfsService.fetchMetadata as jest.Mock).mockResolvedValue(null);

      const req = createMockRequest({
        params: { hash: ipfsHash },
      });
      const res = createMockResponse();

      await ipfsController.getMetadata(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle missing hash parameter', async () => {
      const req = createMockRequest({
        params: {},
      });
      const res = createMockResponse();
      const next = jest.fn();

      await ipfsController.getMetadata(req as any, res as any, next as any);

      // The error should be passed to next function
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('IPFS hash required');
    });
  });
});
