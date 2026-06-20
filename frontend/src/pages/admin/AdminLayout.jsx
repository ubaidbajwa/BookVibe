/**
 * AdminLayout.jsx
 *
 * Shell layout wrapping all admin panel pages. Renders the persistent sidebar
 * and top navbar, then projects child routes into the <Outlet>. The mobile
 * sidebar open/close state is lifted here so the navbar's hamburger button
 * can toggle the sidebar without the two components needing a shared ancestor
 * outside this file.
 */

import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminNavbar from './AdminNavbar'

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6'

const AdminLayout = () => {
    const nav = useNavigate()

    useEffect(() => {
        const token = sessionStorage.getItem('bv_admin_gate')
        if (!token || !token.startsWith('eyJ')) {
            nav(`/${ADMIN_PATH}`, { replace: true })
        }
    }, [nav])

    /**
     * @type {[boolean, Function]}
     * Controls whether the mobile slide-out sidebar is visible.
     * On desktop (lg+) the sidebar is always visible via CSS translate.
     */
    const [open, setOpen] = useState(false)

    return (
        <div className="host-shell flex min-h-screen bg-[var(--bv-bg)]">
            {/* Sidebar: receives open state and setter so it can close itself */}
            <AdminSidebar open={open} setOpen={setOpen} />

            {/* Main column: stacks the navbar above the page content */}
            <div className="flex-1 flex flex-col min-h-screen lg:ml-[260px] transition-all duration-300">
                {/* Navbar needs the setter to wire up its hamburger button */}
                <AdminNavbar setOpenSidebar={setOpen} />

                {/* Page content rendered by the matched child route */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default AdminLayout
