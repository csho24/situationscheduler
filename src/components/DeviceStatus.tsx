import dynamic from 'next/dynamic';

const DeviceStatusClient = dynamic(() => import('./DeviceStatusClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Device Status</h2>
        <div className="p-2 text-gray-600">
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <div className="w-6 h-6 bg-blue-300 rounded animate-pulse"></div>
              </div>
              <div>
                <h3 className="font-medium text-gray-800">Laptop Plug</h3>
                <p className="text-sm text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function DeviceStatus() {
  return <DeviceStatusClient />;
}
