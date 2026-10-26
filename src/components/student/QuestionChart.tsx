import React from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Question } from '../../types';

/** The data chart shown with research questions. Loaded separately because the chart library is large. */
export default function QuestionChart({ chartType, data }: { chartType: Question['chartType']; data: NonNullable<Question['chartData']> }) {
  return (
    <div className="h-64 w-full bg-white rounded-md border border-slate-200 p-3">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="y" name="Series 1" fill="#28656b" />
            {data.some((d) => d.y2 !== undefined) && <Bar dataKey="y2" name="Series 2" fill="#f59e0b" />}
          </BarChart>
        ) : chartType === 'scatter' ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
            <YAxis dataKey="y" tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip />
            <Scatter data={data} fill="#28656b" />
          </ScatterChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fill: '#475569', fontSize: 11 }} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="y" name="Series 1" stroke="#28656b" strokeWidth={2} />
            {data.some((d) => d.y2 !== undefined) && (
              <Line type="monotone" dataKey="y2" name="Series 2" stroke="#f59e0b" strokeWidth={2} />
            )}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
