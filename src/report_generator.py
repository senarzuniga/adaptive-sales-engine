import os

class ReportGenerator:
    def __init__(self):
        self.report_directory = '.ai/reports'

    def generate_report(self, report_data):
        self._ensure_directory_exists()
        report_path = os.path.join(self.report_directory, 'report.txt')
        with open(report_path, 'w') as report_file:
            report_file.write(report_data)

    def _ensure_directory_exists(self):
        if not os.path.exists(self.report_directory):
            os.makedirs(self.report_directory)
