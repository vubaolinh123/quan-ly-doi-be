export const formatAdminSummary = (analysis, messages) => {
  const msgText = messages.join('\n---\n');

  return (
    `📋 *Tố giác mới cần duyệt*\n\n` +
    `📂 Hạng mục: ${analysis.suggestedCategoryCode || 'Chưa xác định'}\n` +
    `🎯 Mức tin cậy: ${Math.round((analysis.confidence || 0) * 100)}%\n\n` +
    `📝 Tóm tắt: ${analysis.adminSummary}\n\n` +
    `💬 Nội dung gốc:\n${msgText}`
  );
};
