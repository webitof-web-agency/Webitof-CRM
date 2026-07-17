import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import { DataTable as Table } from './ui/Table';
import { Select } from './ui/Select';
import { Alert } from './ui/Alert';
import { ConfirmModal } from './ui/ConfirmModal';
import { Loader } from './ui/Loader';
import { PageHeader } from './ui/PageHeader';

export function ShowcasePage() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');
  
  // Table Data
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    { key: 'status', label: 'Status', type: 'badge' },
  ];
  
  const rows = [
    { id: '1', name: 'John Doe', role: 'Admin', status: 'Active' },
    { id: '2', name: 'Jane Smith', role: 'Sales', status: 'Active' },
    { id: '3', name: 'Bob Wilson', role: 'Accountant', status: 'Pending' },
  ];

  // Select Options
  const options = [
    { value: '1', label: 'Apple' },
    { value: '2', label: 'Banana' },
    { value: '3', label: 'Cherry' },
    { value: '4', label: 'Date' },
    { value: '5', label: 'Elderberry' },
  ];

  return (
    <div className="p-6 space-y-12">
      <PageHeader title="UI Components Showcase" description="Testing advanced custom components" />

      {/* Theming */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">1. Dynamic Theming</h2>
        <div className="flex gap-4">
          <Button onClick={() => document.documentElement.setAttribute('data-theme', 'light')}>Light Theme</Button>
          <Button onClick={() => document.documentElement.setAttribute('data-theme', 'dark')}>Dark Theme</Button>
          <Button onClick={() => document.documentElement.setAttribute('data-theme', 'ember')}>Ember Theme</Button>
          <Button onClick={() => document.documentElement.setAttribute('data-theme', 'sage')}>Sage Theme</Button>
        </div>
      </section>

      {/* Sonner Toast */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">2. Sonner Toasts</h2>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => toast.success('Action successful!')}>Success Toast</Button>
          <Button variant="outline" onClick={() => toast.error('Something went wrong!')}>Error Toast</Button>
          <Button variant="outline" onClick={() => toast.info('Here is some information.')}>Info Toast</Button>
        </div>
      </section>

      {/* Modals & Alerts */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">3. Alerts & Modals</h2>
        <div className="grid grid-cols-2 gap-4">
          <Alert type="success" title="Success" description="Your changes have been saved." />
          <Alert type="warning" title="Warning" description="Your storage is almost full." />
          <Alert type="danger" title="Error" description="Failed to delete the record." />
          <Alert type="info" title="Info" description="A new software update is available." />
        </div>
        
        <div className="pt-4">
          <Button onClick={() => setIsConfirmOpen(true)}>Open Confirmation Modal</Button>
          <ConfirmModal 
            open={isConfirmOpen} 
            title="Delete Item" 
            description="Are you sure you want to delete this item? This action cannot be undone." 
            type="danger"
            confirmText="Yes, delete it"
            onCancel={() => setIsConfirmOpen(false)}
            onConfirm={() => {
              toast.success('Item deleted successfully');
              setIsConfirmOpen(false);
            }} 
          />
        </div>
      </section>

      {/* Advanced Select */}
      <section className="space-y-4 max-w-sm">
        <h2 className="text-xl font-bold border-b pb-2">4. Searchable Select</h2>
        <Select 
          options={options} 
          value={selectedValue} 
          onChange={setSelectedValue} 
          placeholder="Select a fruit..." 
        />
      </section>

      {/* Advanced Loading */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">5. Modern Loader</h2>
        <div className="p-8 bg-slate-50 rounded-xl flex justify-center border border-slate-200">
          <Loader size={32} text="Processing your request..." />
        </div>
      </section>

      {/* Advanced Table */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold border-b pb-2">6. Advanced Data Table</h2>
        <Table 
          columns={columns} 
          rows={rows} 
          selectable={true}
        />
      </section>

    </div>
  );
}
