export function friendlyErrorMessage(error: unknown, fallback='操作失败，请稍后重试'): string {
  const raw = typeof error === 'string' ? error : (error as any)?.message || '';
  const map: Array<[RegExp,string]> = [
    [/Invalid VFS state/i,'文件系统当前状态异常。请稍后重试；如果仍然失败，请重启墨思后再操作。'],
    [/network|fetch failed|failed to fetch|timeout/i,'网络连接暂时不可用，请检查网络后重试。'],
    [/jwt|session|not authenticated|auth/i,'登录状态已失效，请重新登录。'],
    [/row-level security|permission denied|not permitted|forbidden/i,'当前账号或设备没有执行此操作的权限。'],
    [/duplicate key|already exists/i,'该内容已经存在，请不要重复提交。'],
    [/storage.*not found|bucket/i,'文件存储服务暂时不可用，请稍后重试。'],
    [/file.*too large|size limit/i,'文件超过当前允许的大小限制。'],
  ];
  for (const [pattern,message] of map) if (pattern.test(raw)) return message;
  return raw || fallback;
}
