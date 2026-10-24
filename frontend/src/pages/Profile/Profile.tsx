import { useEffect } from 'react'
import { IoPerson, IoMail, IoBriefcase, IoShield, IoCalendar } from 'react-icons/io5'
import PageTemplate from '../../components/templates/PageTemplate'
import './Profile.css'

function Profile() {

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <PageTemplate
            title="Administrator Profile"
            subtitle="Main user information for Physoft"
            showBackButton={true}
            breadcrumbItems={[
                { label: 'Profile' }
            ]}
        >
            <div className="profile-container">
                {/* Profile Header */}
                <div className="profile-header">
                    <div className="profile-avatar">
                        <IoPerson />
                    </div>
                    <div className="profile-info">
                        <h2>Administrator</h2>
                        <p className="profile-role">Role: Administrator</p>
                    </div>
                </div>

                {/* Information Section */}
                <div className="profile-section">
                    <div className="profile-section-header">
                        <IoShield className="section-icon" />
                        <h3>General Information</h3>
                    </div>
                    <div className="profile-details">
                        <div className="profile-detail-item">
                            <div className="detail-icon">
                                <IoPerson />
                            </div>
                            <div className="detail-info">
                                <p className="detail-label">Name</p>
                                <p className="detail-value">Physoft Administrator</p>
                            </div>
                        </div>
                        <div className="profile-detail-item">
                            <div className="detail-icon">
                                <IoMail />
                            </div>
                            <div className="detail-info">
                                <p className="detail-label">Email</p>
                                <p className="detail-value">admin@physoft.com</p>
                            </div>
                        </div>
                        <div className="profile-detail-item">
                            <div className="detail-icon">
                                <IoBriefcase />
                            </div>
                            <div className="detail-info">
                                <p className="detail-label">Organization</p>
                                <p className="detail-value">Physoft Sports Analytics</p>
                            </div>
                        </div>
                        <div className="profile-detail-item">
                            <div className="detail-icon">
                                <IoCalendar />
                            </div>
                            <div className="detail-info">
                                <p className="detail-label">Member since</p>
                                <p className="detail-value">December 2025</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageTemplate>
    )
}

export default Profile
