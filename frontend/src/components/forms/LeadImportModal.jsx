import { useState, useRef } from 'react';
import {
  Upload, Download, FileText, CheckCircle2, AlertTriangle, X,
  ArrowRight, RefreshCw, Layers, Check, Database, Users, HelpCircle
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect } from './SearchableSelect';
import { api } from '../../api/client';
import { toast } from 'sonner';

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map((v) => v.replace(/^["']|["']$/g, '').trim());
    if (values.some((v) => v.length > 0)) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
  }
  return { headers, rows };
}

function mapRowToLead(row, defaultPipeline = '', defaultAssigned = '', defaultSource = 'Website', defaultStatus = 'New') {
  const keys = Object.keys(row);
  const getVal = (...aliases) => {
    for (const alias of aliases) {
      const foundKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
      if (foundKey && row[foundKey]) return row[foundKey].trim();
    }
    return '';
  };

  const name = getVal('name', 'contactperson', 'fullname', 'clientname', 'leadname', 'person');
  const company = getVal('company', 'companyname', 'organization', 'businessname', 'org');
  const phone = getVal('phone', 'mobile', 'primarymobile', 'contactnumber', 'phonenumber', 'cell', 'telephone');
  const email = getVal('email', 'emailaddress', 'mail');
  const rawServices = getVal('services', 'requiredservices', 'service', 'requirement', 'requirements');
  const source = getVal('source', 'leadsource', 'origin', 'channel') || defaultSource;
  const status = getVal('status', 'leadstatus', 'stage') || defaultStatus;
  const budget = getVal('budget', 'estimatedbudget', 'value', 'amount', 'dealvalue');
  const temperature = getVal('temperature', 'leadtemperature', 'temp') || 'Warm';
  const priority = getVal('priority', 'urgency') || 'Medium';
  const city = getVal('city', 'location', 'town');
  const state = getVal('state', 'province');
  const notes = getVal('notes', 'summary', 'requirementsummary', 'description', 'remarks');

  const services = rawServices
    ? rawServices.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
    : ['Web Development'];

  const leadPayload = {
    name: name || company || 'Lead',
    contactPerson: name || company || 'Lead',
    companyName: company || name || '',
    phone: phone || '',
    email: email || '',
    requiredServices: services,
    source: source || 'Website',
    status: status || 'New',
    estimatedBudget: budget ? parseFloat(budget.replace(/[^0-9.]/g, '')) || 0 : 0,
    leadTemperature: ['Hot', 'Warm', 'Cold'].includes(temperature) ? temperature : 'Warm',
    priority: ['Urgent', 'High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
    city: city || '',
    state: state || '',
    country: 'India',
    requirementSummary: notes || '',
    pipelineId: defaultPipeline || '',
    assignedTo: defaultAssigned || ''
  };

  return leadPayload;
}

export function LeadImportModal({ open, onClose, onSuccess, pipelines = [], users = [], token }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [defaultPipeline, setDefaultPipeline] = useState(pipelines[0]?.id || '');
  const [defaultAssigned, setDefaultAssigned] = useState('');
  const [defaultSource, setDefaultSource] = useState('Website');
  const [defaultStatus, setDefaultStatus] = useState('New');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  const resetState = () => {
    setFile(null);
    setParsedData(null);
    setIsImporting(false);
    setImportProgress(0);
    setImportResults(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadSample = () => {
    const csvContent =
      'Contact Person,Company Name,Phone,Email,Required Services,Lead Source,Estimated Budget,Status,Temperature,Priority,City,Requirement Summary\n' +
      'Rahul Sharma,Tech Solutions Private Limited,+919876543210,rahul@techsol.com,"Web Development, Custom Software",Website,75000,New,Hot,High,Mumbai,Needs high-speed CRM portal\n' +
      'Priya Patel,Innovate Systems,+919876543211,priya@innovate.com,Digital Marketing,Google Ads,35000,New,Warm,Medium,Delhi,Looking for SEO and PPC campaigns\n' +
      'Amit Verma,Global Exports,+919876543212,amit@globalexports.com,E-commerce Website,LinkedIn,120000,Qualified,Hot,Urgent,Bangalore,B2B marketplace development\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'leads_import_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Sample CSV template downloaded!');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
      toast.error('Please select a valid .csv file');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') return;
        const { headers, rows } = parseCSV(text);
        if (!rows.length) {
          toast.error('The CSV file does not contain any valid rows.');
          return;
        }
        setParsedData({ headers, rows });
        toast.success(`Loaded ${rows.length} rows from CSV!`);
      } catch (err) {
        toast.error('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const leadsToImport = (parsedData?.rows || []).map((row) =>
    mapRowToLead(row, defaultPipeline, defaultAssigned, defaultSource, defaultStatus)
  );

  const validLeads = leadsToImport.filter((l) => l.phone || l.name || l.companyName);

  const handleExecuteImport = async () => {
    if (!validLeads.length) {
      toast.error('No valid leads found to import.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i];
      try {
        await api.resources.create('/leads', lead, token);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({ name: lead.name, error: err.message || 'Validation error' });
      }
      setImportProgress(Math.round(((i + 1) / validLeads.length) * 100));
    }

    setIsImporting(false);
    setImportResults({
      total: validLeads.length,
      successCount,
      errorCount,
      errors
    });

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} leads!`);
      if (onSuccess) onSuccess();
    } else {
      toast.error('Failed to import leads. Check file formatting.');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={isImporting ? () => {} : handleClose}
      title="Import Leads from CSV"
      size="2xl"
    >
      <div className="space-y-6">
        {!parsedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Download size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Download CSV Sample Format</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Use our pre-formatted spreadsheet template with standard fields.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadSample}
                className="!rounded-xl text-xs font-bold border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
              >
                <Download size={14} className="mr-1.5" /> Download Template
              </Button>
            </div>

            {/* Drag & Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-8 text-center transition-all hover:border-blue-500 hover:bg-blue-50/30 dark:hover:border-blue-500 cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-xs mb-3">
                <Upload size={26} />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drag & drop CSV file
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Supports .CSV files with columns: Name, Company, Phone, Email, Services, Source, Budget, etc.
              </p>
            </div>
          </div>
        )}

        {/* Preview & Defaults Step */}
        {parsedData && !importResults && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600" size={18} />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {file?.name}
                </span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {validLeads.length} leads detected
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetState}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                <X size={14} className="mr-1" /> Change file
              </Button>
            </div>

            {/* Default assignment controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 p-3.5">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Pipeline</label>
                <SearchableSelect
                  value={defaultPipeline}
                  onChange={setDefaultPipeline}
                  options={pipelines.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Select Pipeline"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Assign To Employee</label>
                <SearchableSelect
                  value={defaultAssigned}
                  onChange={setDefaultAssigned}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...users.map((u) => ({ value: u.id, label: u.fullName || u.username || u.email }))
                  ]}
                  placeholder="Unassigned"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Source</label>
                <SearchableSelect
                  value={defaultSource}
                  onChange={setDefaultSource}
                  options={[
                    { value: 'Website', label: 'Website' },
                    { value: 'Google Ads', label: 'Google Ads' },
                    { value: 'Facebook Ads', label: 'Facebook Ads' },
                    { value: 'Instagram Ads', label: 'Instagram Ads' },
                    { value: 'LinkedIn', label: 'LinkedIn' },
                    { value: 'WhatsApp', label: 'WhatsApp' },
                    { value: 'Cold Call', label: 'Cold Call' },
                    { value: 'Referral', label: 'Referral' },
                    { value: 'Other', label: 'Other' }
                  ]}
                  placeholder="Website"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Status</label>
                <SearchableSelect
                  value={defaultStatus}
                  onChange={setDefaultStatus}
                  options={[
                    { value: 'New', label: 'New' },
                    { value: 'Contacted', label: 'Contacted' },
                    { value: 'Qualified', label: 'Qualified' },
                    { value: 'Follow-up', label: 'Follow-up' }
                  ]}
                  placeholder="New"
                />
              </div>
            </div>

            {/* Preview Table */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Preview (First 5 records)</span>
                <span>Total: {validLeads.length} leads</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Name / Contact</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Service</th>
                      <th className="p-2">Source</th>
                      <th className="p-2">Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400">
                    {validLeads.slice(0, 5).map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 font-mono text-[10px] text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{l.name}</td>
                        <td className="p-2">{l.companyName || '-'}</td>
                        <td className="p-2 font-mono">{l.phone || <span className="text-rose-500 font-semibold">Missing</span>}</td>
                        <td className="p-2">{l.email || '-'}</td>
                        <td className="p-2">{l.requiredServices?.join(', ') || '-'}</td>
                        <td className="p-2">{l.source}</td>
                        <td className="p-2 font-medium">{l.estimatedBudget ? `₹${l.estimatedBudget.toLocaleString('en-IN')}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Progress bar if importing */}
            {isImporting && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="animate-spin text-blue-600" size={14} /> Importing leads...
                  </span>
                  <span>{importProgress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-200 rounded-full"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Screen */}
        {importResults && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Import Completed</h3>
              <p className="text-xs text-slate-500 mt-1">
                Successfully added <b>{importResults.successCount}</b> of <b>{importResults.total}</b> leads to your CRM.
              </p>
            </div>

            {importResults.errorCount > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-left max-h-36 overflow-y-auto">
                <p className="text-xs font-bold text-rose-700 mb-1">Errors encountered ({importResults.errorCount}):</p>
                {importResults.errors.map((e, idx) => (
                  <p key={idx} className="text-[11px] text-rose-600">
                    • <b>{e.name}</b>: {e.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
          {!importResults ? (
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isImporting} className="!rounded-xl">
                Cancel
              </Button>
              {parsedData && (
                <Button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || !validLeads.length}
                  className="!rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw size={14} className="mr-1.5 animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <Check size={14} className="mr-1.5" /> Start Import ({validLeads.length} Leads)
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button type="button" onClick={handleClose} className="!rounded-xl font-bold">
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
