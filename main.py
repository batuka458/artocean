from fastapi import Depends, FastAPI, HTTPException,status
from fastapi.security import OAuth2PasswordRequestForm
# from fastapi.responses import JSONResponse
from fastapi import UploadFile, File, Form, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from io import BytesIO
import re
from urllib.parse import urlparse
import cloudinary
import cloudinary.uploader
import os
# import traceback
import json
from openai import OpenAI
from datetime import datetime
from pydantic import EmailStr
# from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from security import hash_password,create_token,get_current_artist
from security import verify_password,get_current_user,get_current_organizer
from database import Base, engine, get_db
from models import User,ArtistsProfile,OrganizerProfile,Event,PortfolioItem,Application,EventStatus,UserRole
from schemas import (
    UserCreate,
    UserResponse,
    artist_profilesCreate,
    artist_profilesUpdate,
    artist_profilesResponse,
    artist_publicResponse,

    organizer_profilesCreate,
    organizer_profilesResponse,
    organizer_publicResponse,
    
    LoginRequest,Token,

    portfolio_itemsResponse,

    eventsUpdate,
    eventsResponse,

    applicationsCreate,
    applicationsUpdate,
    applicationsResponse
)
# from fastapi.exceptions import ResponseValidationError

app=FastAPI()


# @app.exception_handler(ResponseValidationError)
# async def response_validation_error(request, exc):
#     print("RESPONSE VALIDATION ERRORS:", exc.errors())
#     print("INVALID RESPONSE:", exc.body)

#     return JSONResponse(
#         status_code=500,
#         content={
#             "detail": "Response validation failed",
#             "errors": [
#                 {
#                     "type": error["type"],
#                     "loc": [str(x) for x in error["loc"]],
#                     "msg": error["msg"]
#                 }
#                 for error in exc.errors()
#             ]
#         }
#     )
Base.metadata.create_all(bind=engine)
# MEDIA_DIR = Path("uploads")
# MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# app.mount(
#     "/uploads",
#     StaticFiles(directory=MEDIA_DIR),
#     name="uploads"
# )

cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
    secure=True
)

def get_cloudinary_asset_info(media_url: str):
    path = urlparse(media_url).path

    if "/upload/" not in path:
        return None

    prefix, asset_path = path.split("/upload/", 1)

    resource_type = prefix.rsplit("/", 1)[-1]

    if resource_type not in {"image", "video", "raw"}:
        return None

    parts = asset_path.strip("/").split("/")

    # Remove the Cloudinary version component.
    version_index = next(
        (
            i for i, part in enumerate(parts)
            if re.fullmatch(r"v\d+", part)
        ),
        None
    )

    if version_index is not None:
        parts = parts[version_index + 1:]

    if not parts:
        return None

    # Remove the delivery file extension.
    parts[-1] = parts[-1].rsplit(".", 1)[0]

    public_id = "/".join(parts)

    return public_id, resource_type


def delete_cloudinary_media(media_url: str):
    asset_info = get_cloudinary_asset_info(media_url)

    if not asset_info:
        print("Could not determine Cloudinary asset information")
        return

    public_id, resource_type = asset_info

    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            invalidate=True
        )

        if result.get("result") not in {"ok", "not found"}:
            print(f"Cloudinary cleanup result: {result}")

    except Exception as exc:
        print(
            f"Cloudinary cleanup failed: "
            f"{type(exc).__name__}: {exc}"
        )

def validate_media_signature(content: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")

    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")

    if content_type == "image/webp":
        return (
            len(content) >= 12
            and content[:4] == b"RIFF"
            and content[8:12] == b"WEBP"
        )

    if content_type == "application/pdf":
        return content.startswith(b"%PDF-")

    if content_type == "video/mp4":
        return len(content) >= 12 and content[4:8] == b"ftyp"

    if content_type == "audio/wav":
        return (
            len(content) >= 12
            and content[:4] == b"RIFF"
            and content[8:12] == b"WAVE"
        )

    if content_type == "audio/mpeg":
        has_id3 = content.startswith(b"ID3")
        has_mpeg_frame = any(
            content[i] == 0xFF and (content[i + 1] & 0xE0) == 0xE0
            for i in range(min(4, len(content) - 1))
        )
        return has_id3 or has_mpeg_frame

    return False


def analyze_portfolio_image(image_url: str) -> dict:
    client = OpenAI(
        api_key=os.environ["GROQ_API_KEY"],
        base_url="https://api.groq.com/openai/v1",
        timeout=20.0,
        max_retries=1,
    )

    response = client.chat.completions.create(
        model=os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b"),
        temperature=0.2,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "You analyze artwork for an artist portfolio. "
                            "Describe only visible evidence. Do not infer "
                            "the artist's identity or unsupported facts. "
                            "Return valid JSON only. "
                            "Analyze this artwork. Return a JSON object with "
                            "exactly these fields: "
                            '"description": a concise visual description, '
                            '"style": a short artistic style label, '
                            '"tags": an array of 5 to 10 short searchable tags. '
                            "Tags should cover visible subjects, medium if "
                            "reasonably identifiable, colors, techniques, "
                            "and themes. Do not include hashtags."
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "low"
                        }
                    }
                ]
            }
        ]
    )

    content = response.choices[0].message.content
    if not content:
        raise ValueError("Groq returned an empty vision response")

    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content
        content = content.removesuffix("```").strip()

    result = json.loads(content)

    return {
        "description": str(result.get("description", ""))[:1000],
        "style": str(result.get("style", ""))[:100],
        "tags": [
            str(tag).strip().lower()
            for tag in result.get("tags", [])
            if str(tag).strip()
        ][:10]
    }

@app.get("/")
def home():
    return {"message":"Hello building beckend for artocean"}


@app.get("/user/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own account"
        )

    return current_user

@app.post("/auth/register", response_model=UserResponse,status_code=status.HTTP_201_CREATED)
def post_user(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    user = User(
        email=user_data.email,
        password=hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login",response_model=Token)
def login(form_data:OAuth2PasswordRequestForm=Depends(),db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="incorrect email or password",
            headers={"Www-Authenticate":"Bearer"}
        )
    if not verify_password(
        form_data.password,
        user.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )
    access_token=create_token(user)
    return{
        "access_token":access_token,
        "token_type":"bearer"
    }

    
@app.patch("/user/{user_id}",response_model=UserResponse)
def upd_user(
    user_id: int,
    email: EmailStr | None = Form(None),
    password: str | None = Form(None),
    media: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own account"
        )

    if email is not None:
        current_user.email = email

    if password is not None:
        current_user.password = hash_password(password)

    if media is not None:
        allowed_image_types = {
            "image/jpeg",
            "image/png",
            "image/webp",
        }
        if media.content_type not in allowed_image_types:
            raise HTTPException(
                status_code=400,
                detail="Profile picture must be a JPEG, PNG, or WebP image"
            )

        max_size = 10 * 1024 * 1024
        try:
            content = media.file.read(max_size + 1)
            if len(content) > max_size:
                raise HTTPException(
                    status_code=413,
                    detail="File exceeds the 10 MB limit"
                )

            upload_result = cloudinary.uploader.upload(
                BytesIO(content),
                resource_type="image",
                folder="profile_pictures"
            )
            profile_pic_url = upload_result.get("secure_url")
            if not profile_pic_url:
                raise HTTPException(
                    status_code=502,
                    detail="Profile picture upload failed"
                )
            current_user.profile_pic_url = profile_pic_url
        finally:
            media.file.close()

    db.commit()
    db.refresh(current_user)
    return current_user

@app.delete("/user/{user_id}",status_code=status.HTTP_204_NO_CONTENT)
def del_user(user_id:int,current_user:User=Depends(get_current_user),db:Session =Depends(get_db)):
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own account"
        )
    db.delete(current_user)
    db.commit()

@app.post(
    "/artist/profile",
    response_model=artist_profilesResponse,
    status_code=status.HTTP_201_CREATED
)
def create_artist_profile(
    profile_data: artist_profilesCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.ARTIST:
        raise HTTPException(
            status_code=403,
            detail="User role must be artist"
        )

    if current_user.artist_profile is not None:
        raise HTTPException(
            status_code=400,
            detail="Artist profile already exists"
        )

    artist = ArtistsProfile(
        user_id=current_user.id,
        full_name=profile_data.full_name,
        bio=profile_data.bio,
        talent_skill=profile_data.talent_skill,
        location=profile_data.location,
        phone_number=profile_data.phone_number
    )

    db.add(artist)
    db.commit()
    db.refresh(artist)

    return artist


@app.post("/organizer/profile/", response_model=organizer_profilesResponse, status_code=status.HTTP_201_CREATED)
def create_organizer_profile( profile_data: organizer_profilesCreate,current_user=Depends(get_current_user), db: Session = Depends(get_db)):

    if current_user.role != UserRole.ORGANIZER:
        raise HTTPException(status_code=403, detail="User role must be organizer")
    if current_user.organizer_profile is not None:
        raise HTTPException(status_code=400, detail="Organizer profile already exists")

    organizer = OrganizerProfile(
        user_id=current_user.id,
        company_name=profile_data.company_name,
        description=profile_data.description,
        website_url=profile_data.website_url,
        location=profile_data.location,
    )
    db.add(organizer)
    db.commit()
    db.refresh(organizer)
    return organizer


@app.get("/artist/", response_model=list[artist_publicResponse])
def artists(
    search:str|None=None,
    location:str|None=None,
    skill:str|None=None,
    limit:int=Query(default=10,ge=1,le=100),
    offset:int=Query(default=0,ge=0),
    db:Session = Depends(get_db)
):
    query=db.query(ArtistsProfile)

    if search:
        search = search.strip()
        query.filter(
            or_(
                ArtistsProfile.full_name.ilike(f"%{search}%"),
                ArtistsProfile.talent_skill.ilike(f"%{search}%")
            )
        )
    if skill:
        query.filter(ArtistsProfile.talent_skill.ilike(f"%{skill.strip()}%"))
    if location:
        query.filter(ArtistsProfile.location.ilike(f"%{location.strip()}"))
    return(
        query.order_by(ArtistsProfile.id).offset(offset).limit(limit).all()
    )

    

@app.get("/artist/profile", response_model=artist_profilesResponse)
def artist(
    current_artist: ArtistsProfile = Depends(get_current_artist)
):
    return current_artist
        

@app.patch("/artist/profile",response_model=artist_profilesResponse)
def update_artist_profile(
    data: artist_profilesUpdate,
    current_artist: ArtistsProfile = Depends(get_current_artist),
    db: Session = Depends(get_db)
):
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_artist, field, value)
    
    db.commit()
    db.refresh(current_artist)

    return current_artist

@app.delete("/artist/profile",status_code=status.HTTP_204_NO_CONTENT)
def del_artist(current_artist:ArtistsProfile=Depends(get_current_artist), db:Session=Depends(get_db)):

    db.delete(current_artist)
    db.commit()

@app.get("/organizer/", response_model=list[organizer_publicResponse])
def organizers(db:Session=Depends(get_db)):
    return db.query(OrganizerProfile).all()

@app.get("/organizer/profile", response_model=organizer_profilesResponse)
def organizer(
    current_organizer: OrganizerProfile = Depends(get_current_organizer)
):
    return current_organizer

@app.patch("/organizer/profile",response_model=organizer_profilesResponse)
def upd_organizer(update_data:organizer_profilesCreate,current_organizer:OrganizerProfile=Depends(get_current_organizer),db:Session=Depends(get_db)):

    data=update_data.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(current_organizer, field, value)
    db.commit()
    db.refresh(current_organizer)
    return current_organizer

@app.delete("/organizer/",status_code=status.HTTP_204_NO_CONTENT)
def del_organizer(current_organizer:OrganizerProfile=Depends(get_current_organizer), db:Session=Depends(get_db)):

    db.delete(current_organizer)
    db.commit()

@app.post(
    "/artist/portfolio",
    response_model=portfolio_itemsResponse,
    status_code=status.HTTP_201_CREATED
)
def create_portfolio_item(
    title: str = Form(...),
    description: str = Form(""),
    media: UploadFile = File(...),
    current_artist: ArtistsProfile = Depends(get_current_artist),
    db: Session = Depends(get_db)
):
    allowed_types = {
        "image/jpeg": "image",
        "image/png": "image",
        "image/webp": "image",
        "video/mp4": "video",
        "audio/mpeg": "audio",
        "audio/wav": "audio",
        "application/pdf": "document",
    }

    media_type = allowed_types.get(media.content_type)

    if media_type is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported media type"
        )

    max_size = 10 * 1024 * 1024  # 10 MB

    try:
        content = media.file.read(max_size + 1)
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail="File exceeds the 10 MB limit"
            )
        if not validate_media_signature(content, media.content_type):
            raise HTTPException(
                status_code=415,
                detail="File content does not match the declared media type"
            )
        upload_result = cloudinary.uploader.upload(
            BytesIO(content),
            resource_type="auto",
            folder="portfolio"
        )
        media_url = upload_result.get("secure_url")
        if not media_url:
            raise HTTPException(
                status_code=502,
                detail="Media upload failed"
            )
        ai_description = None
        ai_style = None
        ai_tags = []

        if media_type == "image":
            try:
                ai_result = analyze_portfolio_image(media_url)

                ai_description = ai_result["description"]
                ai_style = ai_result["style"]
                ai_tags = ai_result["tags"]

            except Exception as exc:
                # AI failure should not prevent an artist from uploading.
                print(
                    f"AI tagging failed: {type(exc).__name__}: {exc}"
                )
        item = PortfolioItem(
            artist_id=current_artist.id,
            title=title,
            description=description,
            media_url=media_url,
            media_type=media_type,
            ai_tags=ai_tags,
            ai_description=ai_description,
            ai_style=ai_style
        )

        db.add(item)

        try:
            db.commit()

        except Exception as exc:
            db.rollback()

            print(
                f"PORTFOLIO DATABASE ERROR: "
                f"{type(exc).__name__}: {exc}"
            )

            # Remove uploaded Cloudinary file if database insert failed.
            if media_url:
                delete_cloudinary_media(media_url)

            raise HTTPException(
                status_code=500,
                detail="Failed to save portfolio item"
            ) from exc

        db.refresh(item)

        return item
    
    finally:
        media.file.close()

@app.get("/artist/portfolio",response_model=list[portfolio_itemsResponse])
def get_artist_portfolio(current_artist:ArtistsProfile=Depends(get_current_artist)):
    return current_artist.portfolios

@app.get("/artist/{artist_id}", response_model=artist_publicResponse)
def public_artist(artist_id: int, db: Session = Depends(get_db)):
    artist = db.query(ArtistsProfile).filter(
        ArtistsProfile.id == artist_id
    ).first()
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist

@app.get("/artist/{artist_id}/portfolio", response_model=list[portfolio_itemsResponse])
def get_public_artist_portfolio(
    artist_id: int, 
    media_type:str|None=None,
    limit:int=Query(default=10,ge=1,le=100),
    offset:int=Query(default=0,ge=0),
    db: Session = Depends(get_db)):
    artist = db.query(ArtistsProfile).filter(
        ArtistsProfile.id == artist_id
    ).first()
    if artist is None:
        raise HTTPException(status_code=404, detail="Artist not found")
    query = db.query(PortfolioItem).filter(
        PortfolioItem.artist_id == artist_id
    )
    if media_type:
        query = query.filter(
            PortfolioItem.media_type.ilike(f"%{media_type}%")
        )

    return query.order_by(PortfolioItem.id).limit(limit).offset(offset).all()
    
    

@app.get("/portfolio/{portfolio_id}",response_model=portfolio_itemsResponse)
def get_portfolio_item(portfolio_id: int,db: Session = Depends(get_db)):
    item = (db.query(PortfolioItem).filter(PortfolioItem.id == portfolio_id).first())
    if not item:
        raise HTTPException(status_code=404,detail="Portfolio item not found")

    return item

@app.patch("/portfolio/{portfolio_id}",response_model=portfolio_itemsResponse)
def update_portfolio_item(
    portfolio_id: int,
    title: str | None = Form(None),
    description: str | None = Form(None),
    ai_tags: list[str] | None = Form(None),
    media: UploadFile | None = File(None),
    current_artist: ArtistsProfile = Depends(get_current_artist),
    db: Session = Depends(get_db)
):
    item = db.query(PortfolioItem).filter(PortfolioItem.id == portfolio_id).first()
    if not item:
        raise HTTPException(status_code=404,detail="Portfolio item not found")
    if item.artist_id != current_artist.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this portfolio item")

    if title is not None:
        item.title = title
    if description is not None:
        item.description = description
    if ai_tags is not None:
        item.ai_tags = ai_tags
    old_media_url = item.media_url if media is not None else None
    new_media_url = None
    if media is not None:
        allowed_types = {
            "image/jpeg": "image",
            "image/png": "image",
            "image/webp": "image",
            "video/mp4": "video",
            "audio/mpeg": "audio",
            "audio/wav": "audio",
            "application/pdf": "document",
        }
        media_type = allowed_types.get(media.content_type)
        if media_type is None:
            raise HTTPException(status_code=400, detail="Unsupported media type")

        max_size = 10 * 1024 * 1024
        try:
            content = media.file.read(max_size + 1)
            if len(content) > max_size:
                raise HTTPException(
                    status_code=413,
                    detail="File exceeds the 10 MB limit"
                )
            if not validate_media_signature(content, media.content_type):
                raise HTTPException(
                    status_code=415,
                    detail="File content does not match the declared media type"
                )
            upload_result = cloudinary.uploader.upload(
                BytesIO(content),
                resource_type="auto",
                folder="portfolio"
            )
            media_url = upload_result.get("secure_url")
            if not media_url:
                raise HTTPException(
                    status_code=502,
                    detail="Media upload failed"
                )

            # Start with empty AI metadata.
            # This prevents old artwork tags from being retained.
            new_ai_description = None
            new_ai_style = None
            new_ai_tags = []

            # Generate fresh metadata only for image uploads.
            if media_type == "image":
                try:
                    ai_result = analyze_portfolio_image(media_url)

                    new_ai_description = ai_result["description"]
                    new_ai_style = ai_result["style"]
                    new_ai_tags = ai_result["tags"]

                except Exception as exc:
                    print(
                        f"AI retagging failed: "
                        f"{type(exc).__name__}: {exc}"
                    )

                    # Keep the new upload, but don't retain old tags.
                    new_ai_description = None
                    new_ai_style = None
                    new_ai_tags = []

            # Update the database object.
            item.media_url = media_url
            item.media_type = media_type
            item.ai_description = new_ai_description
            item.ai_style = new_ai_style
            item.ai_tags = new_ai_tags

        finally:
            media.file.close()

    try:
        db.commit()
        db.refresh(item)

    except Exception as exc:
        db.rollback()

    # Remove the newly uploaded asset if the database update failed.
        if new_media_url:
            delete_cloudinary_media(new_media_url)

        raise HTTPException(
            status_code=500,
            detail="Failed to update portfolio item"
        ) from exc

    # Delete the old asset only after successful database commit.
    if old_media_url and old_media_url != item.media_url:
        delete_cloudinary_media(old_media_url)

    return item

@app.delete("/portfolio/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_item(
    portfolio_id: int,
    current_artist: ArtistsProfile = Depends(get_current_artist),
    db: Session = Depends(get_db)
):
    item = db.query(PortfolioItem).filter(
        PortfolioItem.id == portfolio_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Portfolio item not found"
        )

    if item.artist_id != current_artist.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this portfolio item"
        )

    media_url = item.media_url

    try:
        db.delete(item)
        db.commit()

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete portfolio item"
        ) from exc

    # Database deletion succeeded; now clean up Cloudinary.
    delete_cloudinary_media(media_url)

@app.post("/organizer/events",response_model=eventsResponse,status_code=status.HTTP_201_CREATED)
def create_event(title:str=Form(...),
                 description:str=Form(""),
                 budget:float=Form(...),
                 event_date:datetime=Form(...),
                 event_poster:UploadFile=File(...),current_organizer:OrganizerProfile=Depends(get_current_organizer),db: Session = Depends(get_db)):
    allowed_types = {
        "image/jpeg": "image",
        "image/png": "image",
        "image/webp": "image",
    }

    if (allowed_types.get(event_poster.content_type)) is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported media type"
        )
    max_size=10*1024*1024

    try:
        content = event_poster.file.read(max_size + 1)

        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail="File exceeds 10MB"
            )

        upload_result = cloudinary.uploader.upload(
            BytesIO(content),
            resource_type="image",
            folder="event_poster"
        )

        event_poster_url = upload_result.get("secure_url")

        if not event_poster_url:
            raise HTTPException(
                status_code=502,
                detail="Image upload failed"
            )

        event = Event(
            organizer_id=current_organizer.id,
            title=title,
            description=description,
            budget=budget,
            event_date=event_date,
            event_poster_url=event_poster_url
        )

        db.add(event)

        db.commit()
        db.refresh(event)

        stage = "building response"
        return event


    except Exception as exc:
        db.rollback()
        print(f"EVENT ERROR at {stage}: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Event failed at {stage}: {type(exc).__name__}"
        ) from exc

    finally:
        event_poster.file.close()

@app.get("/events",response_model=list[eventsResponse])
def get_events(
    search:str|None=None,
    status_filter:EventStatus|None=None,
    min_budget:float|None=None,
    max_budget:float|None=None,
    limit:int=Query(default=10,ge=1,le=100),
    offset:int=Query(default=0,ge=0),
    db: Session = Depends(get_db)
):
    query=db.query(Event)

    if search:
        query = query.filter(Event.title.ilike(f"%{search}%"))
    if status_filter:
        query=query.filter(Event.status.ilike(status_filter))
    if min_budget:
        query=query.filter(Event.budget>=min_budget)
    if max_budget:
        query=query.filter(Event.budget<=max_budget)

    return(
        query.order_by(Event.id).offset(offset).limit(limit).all()
    )

@app.get("/events/{event_id}",response_model=eventsResponse)
def get_event(event_id: int,db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404,detail="Event not found")

    return event

@app.get("/organizer/events",response_model=list[eventsResponse])
def load_events(current_organizer:OrganizerProfile=Depends(get_current_organizer)):
    return current_organizer.events

@app.get("/organizer/{organizer_id}", response_model=organizer_publicResponse)
def public_organizer(organizer_id: int, db: Session = Depends(get_db)):
    organizer = db.query(OrganizerProfile).filter(
        OrganizerProfile.id == organizer_id
    ).first()
    if organizer is None:
        raise HTTPException(status_code=404, detail="Organizer not found")
    return organizer

@app.get("/organizer/{organizer_id}/events", response_model=list[eventsResponse])
def get_public_organizer_events(organizer_id: int, db: Session = Depends(get_db)):
    organizer = db.query(OrganizerProfile).filter(
        OrganizerProfile.id == organizer_id
    ).first()
    if organizer is None:
        raise HTTPException(status_code=404, detail="Organizer not found")
    return organizer.events

@app.patch("/events/{event_id}",response_model=eventsResponse)
def upd_event(event_id: int, upd_event: eventsUpdate, current_organizer:OrganizerProfile=Depends(get_current_organizer),db: Session = Depends(get_db)):
    event=db.query(Event).filter(Event.id==event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="event not found")
    if current_organizer.id!=event.organizer_id:
        raise HTTPException(status_code=403,detail="you can update only your events")
    data=upd_event.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update"
        )
    required_fields = ["title", "description", "status"]

    for field in required_fields:
        if field in data and data[field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null"
            )

    if "title" in data:
        data["title"] = data["title"].strip()

        if not data["title"]:
            raise HTTPException(
                status_code=422,
                detail="Title cannot be empty"
            )

    try:
        for key, value in data.items():
            setattr(event, key, value)

        db.commit()
        db.refresh(event)

        return event

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update event"
        )

@app.delete("/events/{event_id}",status_code=status.HTTP_204_NO_CONTENT)
def del_event(event_id:int,current_organizer:OrganizerProfile=Depends(get_current_organizer),db:Session=Depends(get_db)):

    event=db.query(Event).filter(Event.id==event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="event not found")

    if current_organizer.id!=event.organizer_id:
        raise HTTPException(status_code=403,detail="you can delete only your events")
    db.delete(event)
    db.commit()

@app.post("/events/{event_id}/applications",response_model=applicationsResponse,status_code=status.HTTP_201_CREATED)
def create_application(event_id: int,data: applicationsCreate,current_artist:ArtistsProfile=Depends(get_current_artist),db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404,detail="Event not found")

    artist = db.query(ArtistsProfile).filter(ArtistsProfile.id == current_artist.id).first()
    if not artist:
        raise HTTPException(status_code=404,detail="Artist not found")

    if event.status != EventStatus.OPEN:
        raise HTTPException(status_code=400,detail="Applications are closed for this event")

    existing_application = db.query(Application).filter(Application.event_id == event_id,Application.artist_id == current_artist.id).first()

    if existing_application:
        raise HTTPException(status_code=409,detail="Artist has already applied to this event")

    application = Application(
        event_id=event_id,
        artist_id=current_artist.id,
        pitch_note=data.pitch_note
    )

    db.add(application)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Artist has already applied to this event"
        )

    db.refresh(application)

    return application

@app.get("/events/{event_id}/applications",response_model=list[applicationsResponse])
def get_event_applications(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if current_user.role == UserRole.ORGANIZER:
        organizer = current_user.organizer_profile
        if organizer is None:
            raise HTTPException(status_code=403, detail="Organizer profile not found")
        if event.organizer_id != organizer.id:
            raise HTTPException(status_code=403, detail="You can only view applications for your own events")

        return db.query(Application).filter(
            Application.event_id == event_id
        ).all()

    if current_user.role == UserRole.ARTIST:
        artist = current_user.artist_profile
        if artist is None:
            raise HTTPException(status_code=403, detail="Artist profile not found")

        return db.query(Application).filter(
            Application.event_id == event_id,
            Application.artist_id == artist.id
        ).all()

    raise HTTPException(status_code=403, detail="Access denied")
    


@app.get("/applications/{application_id}",response_model=applicationsResponse)
def get_application(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    application = db.query(Application).filter(
        Application.id == application_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == UserRole.ARTIST:
        artist = current_user.artist_profile
        if artist is None:
            raise HTTPException(status_code=403, detail="Artist profile not found")
        if application.artist_id != artist.id:
            raise HTTPException(status_code=403, detail="You can only view your own applications")
        return application

    if current_user.role == UserRole.ORGANIZER:
        organizer = current_user.organizer_profile
        if organizer is None:
            raise HTTPException(status_code=403, detail="Organizer profile not found")
        if application.event.organizer_id != organizer.id:
            raise HTTPException(status_code=403, detail="You can only view applications for your own events")
        return application

    raise HTTPException(status_code=403, detail="Access denied")

@app.patch("/applications/{application_id}",response_model=applicationsResponse)
def update_application(application_id: int,data: applicationsUpdate,current_organizer:OrganizerProfile=Depends(get_current_organizer),db: Session = Depends(get_db)):
    application = db.query(Application).filter(Application.id == application_id).first()

    if not application:
        raise HTTPException(status_code=404,detail="Application not found")
    if current_organizer.id!=application.event.organizer_id:
        raise HTTPException(status_code=403,detail="you can only update status of your events")
    application.status = data.status

    db.commit()
    db.refresh(application)

    return application

@app.delete("/applications/{application_id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int,current_artist:ArtistsProfile=Depends(get_current_artist),db: Session = Depends(get_db)):
    application = db.query(Application).filter(Application.id == application_id).first()

    if not application:
        raise HTTPException(status_code=404,detail="Application not found")
    if application.artist_id!=current_artist.id:
        raise HTTPException(status_code=403,detail="you can only delete your application")
    db.delete(application)
    db.commit()

@app.get("/auth/me",response_model=UserResponse)
def get_me(
    current_user:User=Depends(get_current_user)
):
    return current_user
