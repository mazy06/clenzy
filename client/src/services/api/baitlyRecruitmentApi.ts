import apiClient from '../apiClient';
import type { BaitlyRecruitmentPage } from '../baitlyRecruitment';
export const baitlyRecruitmentApi = {
  own:()=>apiClient.get<{available:boolean;page:Partial<BaitlyRecruitmentPage>}>('/prospect-inquiries/recruitment'),
  save:(page:BaitlyRecruitmentPage)=>apiClient.put<BaitlyRecruitmentPage>('/prospect-inquiries/recruitment',page),
};
