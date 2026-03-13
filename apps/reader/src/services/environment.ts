import type { AppService } from '@/types/system';

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let _appService: AppService | null = null;

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (!_appService) {
      const { WebAppService } = await import('./webAppService');
      _appService = new WebAppService();
      await _appService.init();
    }
    return _appService;
  },
};

export default environmentConfig;
