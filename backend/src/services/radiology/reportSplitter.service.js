class ReportSplitterService {
  split(rawText, classifiedModalities) {
    if (!rawText || !classifiedModalities || classifiedModalities.length === 0) {
      return [];
    }

    const sections = [];

    for (let i = 0; i < classifiedModalities.length; i++) {
      const current = classifiedModalities[i];
      const next = classifiedModalities[i + 1];

      const start = current.matchIndex;
      const end = next ? next.matchIndex : rawText.length;
      const sectionText = rawText.slice(start, end).trim();

      sections.push({
        modalityKey: current.key,
        rawSectionText: sectionText,
        charStart: start,
        charEnd: end
      });
    }

    return sections;
  }
}

module.exports = new ReportSplitterService();
