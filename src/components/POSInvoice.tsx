import { forwardRef } from 'react'

export interface InvoiceData {
    saleId: string
    invoiceNumber: string
    date: Date
    branchName: string
    cashierName: string
    items: {
        name: string
        weight: number
        purity: string
        quantity: number
        unitPrice: number
        total: number
    }[]
    subtotal: number
    discountPercent: number
    discountAmount: number
    taxPercent: number
    taxAmount: number
    totalAmount: number
    paymentMethod: 'CASH' | 'CARD' | 'UPI'
    customerName?: string
    customerPhone?: string
}

const POSInvoice = forwardRef<HTMLDivElement, { data: InvoiceData }>(({ data }, ref) => {
    const formatCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`
    const time = data.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    const dateStr = data.date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

    return (
        <div ref={ref} className="pos-invoice">
            <style>{`
                .pos-invoice {
                    font-family: 'Courier New', Courier, monospace;
                    width: 300px;
                    margin: 0 auto;
                    padding: 16px;
                    color: #000;
                    background: #fff;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .pos-invoice .inv-header {
                    text-align: center;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }
                .pos-invoice .inv-header h1 {
                    font-size: 18px;
                    font-weight: 900;
                    margin: 0;
                    letter-spacing: 2px;
                }
                .pos-invoice .inv-header p {
                    margin: 2px 0;
                    font-size: 11px;
                }
                .pos-invoice .inv-meta {
                    border-bottom: 1px dashed #000;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }
                .pos-invoice .inv-meta-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                }
                .pos-invoice table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 8px 0;
                }
                .pos-invoice th {
                    border-bottom: 1px solid #000;
                    border-top: 1px solid #000;
                    padding: 4px 2px;
                    text-align: left;
                    font-size: 11px;
                }
                .pos-invoice th:last-child,
                .pos-invoice td:last-child {
                    text-align: right;
                }
                .pos-invoice td {
                    padding: 3px 2px;
                    font-size: 11px;
                    vertical-align: top;
                }
                .pos-invoice .inv-summary {
                    border-top: 1px dashed #000;
                    padding-top: 8px;
                    margin-top: 8px;
                }
                .pos-invoice .inv-summary-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    padding: 2px 0;
                }
                .pos-invoice .inv-total-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                    font-weight: 900;
                    border-top: 2px solid #000;
                    padding-top: 6px;
                    margin-top: 4px;
                }
                .pos-invoice .inv-payment {
                    text-align: center;
                    margin: 10px 0;
                    padding: 4px;
                    border: 1px solid #000;
                    font-weight: 700;
                    font-size: 12px;
                }
                .pos-invoice .inv-footer {
                    text-align: center;
                    border-top: 1px dashed #000;
                    padding-top: 8px;
                    margin-top: 12px;
                    font-size: 10px;
                }
                .pos-invoice .inv-footer p {
                    margin: 2px 0;
                }

                @media print {
                    body * { visibility: hidden !important; }
                    .pos-invoice, .pos-invoice * { visibility: visible !important; }
                    .pos-invoice {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 80mm !important;
                        padding: 4mm !important;
                        margin: 0 !important;
                    }
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                }
            `}</style>

            {/* ── Header ── */}
            <div className="inv-header">
                <h1>VIRUDTI JEWELLS</h1>
                <p>Madurai, Tamil Nadu</p>
                <p>Phone: +91 9600996579</p>
            </div>

            {/* ── Invoice Meta ── */}
            <div className="inv-meta">
                <div className="inv-meta-row">
                    <span>Invoice No</span>
                    <span><strong>{data.invoiceNumber}</strong></span>
                </div>
                <div className="inv-meta-row">
                    <span>Date</span>
                    <span>{dateStr}</span>
                </div>
                <div className="inv-meta-row">
                    <span>Time</span>
                    <span>{time}</span>
                </div>
                <div className="inv-meta-row">
                    <span>Branch</span>
                    <span>{data.branchName}</span>
                </div>
                <div className="inv-meta-row">
                    <span>Cashier</span>
                    <span>{data.cashierName}</span>
                </div>
                {data.customerName && (
                    <div className="inv-meta-row">
                        <span>Customer</span>
                        <span>{data.customerName}</span>
                    </div>
                )}
                {data.customerPhone && (
                    <div className="inv-meta-row">
                        <span>Phone</span>
                        <span>{data.customerPhone}</span>
                    </div>
                )}
            </div>

            {/* ── Items Table ── */}
            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, i) => (
                        <tr key={i}>
                            <td>
                                {item.name}
                                {item.weight > 0 && (
                                    <div style={{ fontSize: '9px', color: '#666' }}>
                                        {item.weight}g · {item.purity}
                                    </div>
                                )}
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unitPrice)}</td>
                            <td>{formatCurrency(item.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ── Summary ── */}
            <div className="inv-summary">
                <div className="inv-summary-row">
                    <span>Subtotal</span>
                    <span>{formatCurrency(data.subtotal)}</span>
                </div>
                {data.discountAmount > 0 && (
                    <div className="inv-summary-row">
                        <span>Discount ({data.discountPercent}%)</span>
                        <span>-{formatCurrency(data.discountAmount)}</span>
                    </div>
                )}
                {data.taxAmount > 0 && (
                    <div className="inv-summary-row">
                        <span>GST ({data.taxPercent}%)</span>
                        <span>{formatCurrency(data.taxAmount)}</span>
                    </div>
                )}
                <div className="inv-total-row">
                    <span>TOTAL</span>
                    <span>{formatCurrency(data.totalAmount)}</span>
                </div>
            </div>

            {/* ── Payment ── */}
            <div className="inv-payment">
                Payment Mode: {data.paymentMethod}
            </div>

            {/* ── Footer ── */}
            <div className="inv-footer">
                <p><strong>Thank you for shopping with Virudti Jewells</strong></p>
                <p>Goods once sold cannot be returned</p>
                <p style={{ marginTop: '6px', fontSize: '9px', color: '#999' }}>
                    {data.invoiceNumber} · {dateStr}
                </p>
            </div>
        </div>
    )
})

POSInvoice.displayName = 'POSInvoice'
export default POSInvoice
