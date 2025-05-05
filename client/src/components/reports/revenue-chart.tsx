import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format-utils';

// Define the data structure for the chart
interface RevenueChartData {
  name: string;
  revenue: number;
  expenses: number;
}

interface RevenueChartProps {
  data: RevenueChartData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Custom tooltip formatter to show currency values
  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          height={60}
          tickMargin={10}
        />
        <YAxis 
          tickFormatter={formatTooltipValue}
          tick={{ fontSize: 12 }}
          width={80}
        />
        <Tooltip 
          formatter={formatTooltipValue}
          labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
          contentStyle={{ 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            padding: '10px',
            backgroundColor: 'white'
          }}
        />
        <Legend 
          verticalAlign="top" 
          height={36}
          formatter={(value) => <span style={{ fontSize: '14px', color: '#666' }}>{value}</span>} 
        />
        <Bar 
          dataKey="revenue" 
          name="Revenue" 
          fill="#10b981" 
          radius={[4, 4, 0, 0]}
        />
        <Bar 
          dataKey="expenses" 
          name="Expenses" 
          fill="#ef4444" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}